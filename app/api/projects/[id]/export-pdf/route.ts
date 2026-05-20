import { cookies } from "next/headers";
import { join } from "path";
import { readFile } from "fs/promises";
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { getSession, getUserById } from "@/lib/auth";
import {
  getEstimateLineItems,
  getEstimateTotal,
  getProjectById,
  getProjectSignatures,
  getProjectsByUserId,
  getProjectEstimateSettings,
  getActiveEstimateDelivery,
} from "@/lib/projects";
import { DISCLOSURE_SECTIONS } from "@/lib/estimate-terms";
import {
  calculateEstimateBreakdown,
  calculateInstallmentAmounts,
  formatCurrency,
} from "@/lib/estimate";
import {
  formatTlCorpPhone,
  getTlCorpOrganization,
  type TlCorpOrganization,
} from "@/lib/tl-corp-organization";
import { getEstimateClientDisplayForEmail } from "@/lib/crm-clients";

type FontType = Awaited<ReturnType<PDFDocument["embedFont"]>>;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;

const COLOR_NAVY = rgb(0.01, 0.13, 0.31);
const COLOR_TEXT = rgb(0.12, 0.12, 0.12);
const COLOR_MUTED = rgb(0.43, 0.45, 0.5);
const COLOR_LINE = rgb(0.83, 0.85, 0.89);
const COLOR_PANEL = rgb(0.96, 0.97, 0.99);

function buildOrganizationPdfLines(organization: TlCorpOrganization): string[] {
  const lines = [
    organization.business_name,
    organization.registration_label,
    organization.address_line1,
    organization.city_state,
    organization.postal_code,
    formatTlCorpPhone(organization.phone),
    organization.email,
  ];
  if (organization.website.trim()) {
    lines.push(`Web: ${organization.website.trim()}`);
  }
  return lines.map((line) => line.trim()).filter(Boolean);
}

function formatInvoiceDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function wrapText(
  text: string,
  maxWidth: number,
  font: FontType,
  size: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }

  lines.push(current);
  return lines;
}

function parseSignatureDataUri(
  dataUri: string
): { bytes: Uint8Array; type: "png" | "jpg" } | null {
  const match = dataUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) return null;

  const type = match[1] === "png" ? "png" : "jpg";
  return { type, bytes: Buffer.from(match[2], "base64") };
}

function newPage(pdfDoc: PDFDocument): PDFPage {
  return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

function drawWrappedParagraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: FontType,
  size: number,
  lineHeight: number,
  color = COLOR_TEXT
): number {
  const lines = wrapText(text, maxWidth, font, size);
  let nextY = y;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: nextY,
      size,
      font,
      color,
    });
    nextY -= lineHeight;
  }
  return nextY;
}

function drawPageNumbers(pdfDoc: PDFDocument, font: FontType): void {
  const pages = pdfDoc.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    const label = `Page ${index + 1} of ${total}`;
    const size = 9;
    const textWidth = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: PAGE_WIDTH - MARGIN - textWidth,
      y: PAGE_HEIGHT - 22,
      size,
      font,
      color: COLOR_MUTED,
    });
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "employee") {
      return Response.json(
        { error: "Employees cannot export project estimate PDFs" },
        { status: 403 }
      );
    }

    if (user.role === "client") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((project) => project.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const delivery = await getActiveEstimateDelivery(id);
    if (user.role === "client" && !delivery) {
      return Response.json({ error: "Estimate has not been sent yet" }, { status: 403 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const [liveLineItems, liveTotal, signatures, settings, activeDelivery, organization] =
      await Promise.all([
        getEstimateLineItems(id),
        getEstimateTotal(id),
        getProjectSignatures(id),
        getProjectEstimateSettings(id),
        user.role === "client" ? Promise.resolve(delivery) : getActiveEstimateDelivery(id),
        getTlCorpOrganization(),
      ]);

    const useSnapshot = user.role === "client" && activeDelivery;
    const resolvedDelivery = activeDelivery || delivery;
    const lineItems = useSnapshot ? resolvedDelivery!.snapshot_line_items : liveLineItems;
    const estimateSettings = useSnapshot ? resolvedDelivery!.snapshot_settings : settings;
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const breakdown = calculateEstimateBreakdown(subtotal, estimateSettings);
    const grandTotal = useSnapshot ? resolvedDelivery!.snapshot_total : breakdown.total;
    const installments = calculateInstallmentAmounts(grandTotal, estimateSettings.installment_schedule);

    const hideClientLineItemPricing =
      user.role === "client" && project.hide_line_item_prices_for_client;

    const clientDisplay = resolvedDelivery
      ? await getEstimateClientDisplayForEmail(resolvedDelivery.sent_to_email)
      : null;

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let logo:
      | Awaited<ReturnType<PDFDocument["embedPng"]>>
      | null = null;
    const logoCandidates = ["site-icon-from-ico.png", "site-icon.png", "NoTextLogoFIXED.png"];
    for (const candidate of logoCandidates) {
      try {
        const logoPath = join(process.cwd(), "public", candidate);
        const logoBytes = await readFile(logoPath);
        logo = await pdfDoc.embedPng(logoBytes);
        break;
      } catch {
        // Try next candidate.
      }
    }

    const invoiceDate = new Date();
    const invoiceNumber = project.id.slice(0, 6).toUpperCase();
    const clientSignature = signatures.find((signature) => signature.signer_role === "client");
    const adminSignature = signatures.find((signature) => signature.signer_role === "admin");

    let page = newPage(pdfDoc);
    let y = PAGE_HEIGHT - MARGIN;

    const logoBoxSize = 48;
    const logoBoxX = MARGIN;
    const logoBoxY = y - logoBoxSize;
    page.drawRectangle({
      x: logoBoxX,
      y: logoBoxY,
      width: logoBoxSize,
      height: logoBoxSize,
      color: rgb(1, 1, 1),
      borderColor: COLOR_LINE,
      borderWidth: 1,
    });
    if (logo) {
      const innerPadding = 5;
      const maxW = logoBoxSize - innerPadding * 2;
      const maxH = logoBoxSize - innerPadding * 2;
      const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
      const drawW = logo.width * scale;
      const drawH = logo.height * scale;
      page.drawImage(logo, {
        x: logoBoxX + (logoBoxSize - drawW) / 2,
        y: logoBoxY + (logoBoxSize - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    } else {
      page.drawText("TL", {
        x: logoBoxX + 13,
        y: logoBoxY + 16,
        size: 16,
        font: fontBold,
        color: COLOR_NAVY,
      });
    }

    const orgLines = buildOrganizationPdfLines(organization);
    orgLines.forEach((line, index) => {
      const isBusinessName = index === 0;
      page.drawText(line, {
        x: MARGIN + 64,
        y: y - 2 - index * 13,
        size: isBusinessName ? 11 : 9,
        font: isBusinessName ? fontBold : fontRegular,
        color: isBusinessName ? COLOR_NAVY : COLOR_TEXT,
      });
    });

    page.drawText("INVOICE", {
      x: PAGE_WIDTH - MARGIN - 96,
      y: y - 8,
      size: 24,
      font: fontBold,
      color: COLOR_NAVY,
    });

    const infoX = PAGE_WIDTH - MARGIN - 190;
    const infoY = y - 106;
    const infoW = 190;
    const infoH = 82;
    page.drawRectangle({
      x: infoX,
      y: infoY,
      width: infoW,
      height: infoH,
      color: COLOR_PANEL,
      borderColor: COLOR_LINE,
      borderWidth: 1,
    });

    const rowStart = infoY + infoH - 18;
    const infoLabelX = infoX + 10;
    const infoValueX = infoX + 98;
    page.drawText("Invoice #", {
      x: infoLabelX,
      y: rowStart,
      size: 9,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText(invoiceNumber, {
      x: infoValueX,
      y: rowStart,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    page.drawText("Date", {
      x: infoLabelX,
      y: rowStart - 20,
      size: 9,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText(formatInvoiceDate(invoiceDate), {
      x: infoValueX,
      y: rowStart - 20,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    page.drawText("Payment terms", {
      x: infoLabelX,
      y: rowStart - 40,
      size: 9,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText("Due upon receipt", {
      x: infoValueX,
      y: rowStart - 40,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });

    const boxTop = y - 130;
    const boxGap = 12;
    const boxW = (PAGE_WIDTH - MARGIN * 2 - boxGap) / 2;
    const boxH = 88;
    const leftBoxX = MARGIN;
    const rightBoxX = MARGIN + boxW + boxGap;
    const boxY = boxTop - boxH;

    page.drawRectangle({
      x: leftBoxX,
      y: boxY,
      width: boxW,
      height: boxH,
      color: rgb(1, 1, 1),
      borderColor: COLOR_LINE,
      borderWidth: 1,
    });
    page.drawRectangle({
      x: rightBoxX,
      y: boxY,
      width: boxW,
      height: boxH,
      color: rgb(1, 1, 1),
      borderColor: COLOR_LINE,
      borderWidth: 1,
    });

    page.drawText("Service Address", {
      x: leftBoxX + 10,
      y: boxTop - 16,
      size: 10,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText("Bill To", {
      x: rightBoxX + 10,
      y: boxTop - 16,
      size: 10,
      font: fontBold,
      color: COLOR_NAVY,
    });

    const serviceText =
      clientDisplay?.serviceAddress?.trim() ||
      project.address?.trim() ||
      "No service address provided";
    const serviceLines = wrapText(serviceText, boxW - 20, fontRegular, 9);
    let serviceY = boxTop - 31;
    for (const line of serviceLines.slice(0, 4)) {
      page.drawText(line, {
        x: leftBoxX + 10,
        y: serviceY,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      serviceY -= 12;
    }

    const billToName =
      clientDisplay?.clientName ||
      clientSignature?.signer_name ||
      "Project Client";
    const billingText = clientDisplay?.billingAddress?.trim() || "—";
    const billToLines = [billToName, ...wrapText(billingText, boxW - 20, fontRegular, 9).slice(0, 3)];
    let billY = boxTop - 31;
    for (const line of billToLines) {
      page.drawText(line, {
        x: rightBoxX + 10,
        y: billY,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      billY -= 12;
    }

    y = boxY - 20;

    // Total + Payment Schedule (above line items)
    page.drawRectangle({
      x: MARGIN,
      y: y - 72,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 80,
      color: COLOR_PANEL,
      borderColor: COLOR_LINE,
      borderWidth: 1,
    });
    page.drawText("TOTAL ESTIMATE", {
      x: MARGIN + 12,
      y: y - 22,
      size: 10,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText(formatCurrency(grandTotal), {
      x: MARGIN + 12,
      y: y - 42,
      size: 22,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText("PAYMENT SCHEDULE", {
      x: MARGIN + 220,
      y: y - 22,
      size: 10,
      font: fontBold,
      color: COLOR_NAVY,
    });
    let installmentY = y - 36;
    for (const inst of installments.slice(0, 4)) {
      page.drawText(
        `${inst.label}: ${formatCurrency(inst.amount)} (${inst.percent}%) — ${inst.due_description}`,
        {
          x: MARGIN + 220,
          y: installmentY,
          size: 8,
          font: fontRegular,
          color: COLOR_TEXT,
        }
      );
      installmentY -= 11;
    }

    y -= 96;
    page.drawText("Description", {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    y -= 16;

    const tableLeft = MARGIN;
    const tableWidth = PAGE_WIDTH - MARGIN * 2;
    const qtyW = 52;
    const rateW = 78;
    const amountW = 90;
    const descW = hideClientLineItemPricing
      ? tableWidth - qtyW - 20
      : tableWidth - qtyW - rateW - amountW - 28;

    const drawTableHeader = (targetPage: PDFPage, targetY: number): number => {
      targetPage.drawRectangle({
        x: tableLeft,
        y: targetY - 18,
        width: tableWidth,
        height: 20,
        color: COLOR_NAVY,
      });

      targetPage.drawText("Description", {
        x: tableLeft + 8,
        y: targetY - 12,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      const qtyX = hideClientLineItemPricing
        ? tableLeft + descW + 12
        : tableLeft + descW + 16;
      targetPage.drawText("Qty", {
        x: qtyX,
        y: targetY - 12,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      if (!hideClientLineItemPricing) {
        const rateX = tableLeft + descW + qtyW + 18;
        const amountX = tableLeft + descW + qtyW + rateW + 20;
        targetPage.drawText("Rate", {
          x: rateX,
          y: targetY - 12,
          size: 9,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
        targetPage.drawText("Amount", {
          x: amountX,
          y: targetY - 12,
          size: 9,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      }

      return targetY - 24;
    };

    y = drawTableHeader(page, y);

    for (let index = 0; index < lineItems.length; index++) {
      const item = lineItems[index];
      const category =
        item.category === "custom"
          ? item.custom_category_name || "Custom"
          : item.category;
      const description = item.description?.trim() || "-";
      const descriptionLines = wrapText(description, descW - 16, fontRegular, 9);
      const rowHeight = Math.max(32, 22 + descriptionLines.length * 10);

      if (y - rowHeight < MARGIN + 120) {
        page = newPage(pdfDoc);
        y = PAGE_HEIGHT - MARGIN - 18;
        page.drawText(`Invoice ${invoiceNumber} - Description (continued)`, {
          x: MARGIN,
          y,
          size: 10,
          font: fontBold,
          color: COLOR_NAVY,
        });
        y -= 14;
        y = drawTableHeader(page, y);
      }

      if (index % 2 === 0) {
        page.drawRectangle({
          x: tableLeft,
          y: y - rowHeight + 3,
          width: tableWidth,
          height: rowHeight,
          color: rgb(0.99, 0.99, 1),
        });
      }

      const descX = tableLeft + 8;
      const rowTopY = y - 12;

      page.drawText(category.toUpperCase(), {
        x: descX,
        y: rowTopY,
        size: 9,
        font: fontBold,
        color: COLOR_NAVY,
      });

      let descY = rowTopY - 11;
      for (const line of descriptionLines) {
        page.drawText(line, {
          x: descX,
          y: descY,
          size: 9,
          font: fontRegular,
          color: COLOR_TEXT,
        });
        descY -= 10;
      }

      const qtyX = hideClientLineItemPricing
        ? tableLeft + descW + 12
        : tableLeft + descW + 16;
      page.drawText(String(item.quantity), {
        x: qtyX,
        y: rowTopY,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });

      if (!hideClientLineItemPricing) {
        const rateX = tableLeft + descW + qtyW + 18;
        const amountX = tableLeft + descW + qtyW + rateW + 20;
        page.drawText(formatCurrency(item.price_rate), {
          x: rateX,
          y: rowTopY,
          size: 9,
          font: fontRegular,
          color: COLOR_TEXT,
        });
        page.drawText(formatCurrency(item.total), {
          x: amountX,
          y: rowTopY,
          size: 9,
          font: fontBold,
          color: COLOR_TEXT,
        });
      }

      page.drawLine({
        start: { x: tableLeft, y: y - rowHeight + 3 },
        end: { x: tableLeft + tableWidth, y: y - rowHeight + 3 },
        thickness: 0.6,
        color: COLOR_LINE,
      });

      y -= rowHeight;
    }

    if (y < MARGIN + 120) {
      page = newPage(pdfDoc);
      y = PAGE_HEIGHT - MARGIN - 10;
    }

    const totalsTop = y - 12;
    const totalsX = PAGE_WIDTH - MARGIN - 230;
    const totalsW = 230;
    const totalsH = 68;
    page.drawRectangle({
      x: totalsX,
      y: totalsTop - totalsH,
      width: totalsW,
      height: totalsH,
      color: COLOR_PANEL,
      borderColor: COLOR_LINE,
      borderWidth: 1,
    });

    page.drawText("Subtotal", {
      x: totalsX + 12,
      y: totalsTop - 20,
      size: 10,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText(formatCurrency(subtotal), {
      x: totalsX + totalsW - 95,
      y: totalsTop - 20,
      size: 10,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    page.drawText("Total", {
      x: totalsX + 12,
      y: totalsTop - 44,
      size: 12,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText(formatCurrency(grandTotal), {
      x: totalsX + totalsW - 95,
      y: totalsTop - 44,
      size: 12,
      font: fontBold,
      color: COLOR_NAVY,
    });

    if (hideClientLineItemPricing) {
      page.drawText(
        "Line-item pricing is hidden for client view per project settings.",
        {
          x: MARGIN,
          y: totalsTop - 38,
          size: 9,
          font: fontRegular,
          color: COLOR_MUTED,
        }
      );
    }

    page = newPage(pdfDoc);
    y = PAGE_HEIGHT - MARGIN;

    const drawDisclosureHeading = (title: string) => {
      page.drawText(title, {
        x: MARGIN,
        y,
        size: 16,
        font: fontBold,
        color: COLOR_NAVY,
      });
      y -= 24;
    };

    drawDisclosureHeading("Disclosures, Terms, and Warranty");

    for (let sectionIndex = 0; sectionIndex < DISCLOSURE_SECTIONS.length; sectionIndex++) {
      const section = DISCLOSURE_SECTIONS[sectionIndex];

      if (y < MARGIN + 90) {
        page = newPage(pdfDoc);
        y = PAGE_HEIGHT - MARGIN;
        drawDisclosureHeading("Disclosures (continued)");
      }

      page.drawText(section.title, {
        x: MARGIN,
        y,
        size: 11,
        font: fontBold,
        color: COLOR_NAVY,
      });
      y -= 14;

      for (const line of section.lines) {
        const wrapped = wrapText(line, PAGE_WIDTH - MARGIN * 2 - 18, fontRegular, 9);
        for (let i = 0; i < wrapped.length; i++) {
          if (y < MARGIN + 40) {
            page = newPage(pdfDoc);
            y = PAGE_HEIGHT - MARGIN;
            drawDisclosureHeading("Disclosures (continued)");
          }

          const prefix = i === 0 ? "- " : "  ";
          page.drawText(`${prefix}${wrapped[i]}`, {
            x: MARGIN + 6,
            y,
            size: 9,
            font: fontRegular,
            color: COLOR_TEXT,
          });
          y -= 11;
        }
      }

      y -= 8;
    }

    page = newPage(pdfDoc);
    y = PAGE_HEIGHT - MARGIN;

    page.drawText("Customer Acceptance", {
      x: MARGIN,
      y,
      size: 16,
      font: fontBold,
      color: COLOR_NAVY,
    });
    y -= 22;

    y = drawWrappedParagraph(
      page,
      "By signing this document, the customer agrees to the services and conditions outlined in this document.",
      MARGIN,
      y,
      PAGE_WIDTH - MARGIN * 2,
      fontRegular,
      10,
      13,
      COLOR_TEXT
    );
    y -= 18;

    const signatureBlockW = (PAGE_WIDTH - MARGIN * 2 - 14) / 2;
    const signatureBlockH = 200;
    const adminBlockX = MARGIN;
    const clientBlockX = MARGIN + signatureBlockW + 14;
    const blockY = y - signatureBlockH;

    const drawSignatureBlock = async (
      blockPage: PDFPage,
      x: number,
      label: string,
      signerName: string | undefined,
      signedAt: string | undefined,
      signatureData: string | undefined
    ): Promise<void> => {
      blockPage.drawRectangle({
        x,
        y: blockY,
        width: signatureBlockW,
        height: signatureBlockH,
        color: rgb(1, 1, 1),
        borderColor: COLOR_LINE,
        borderWidth: 1,
      });

      blockPage.drawText(label, {
        x: x + 10,
        y: blockY + signatureBlockH - 16,
        size: 10,
        font: fontBold,
        color: COLOR_NAVY,
      });

      blockPage.drawText(`Name: ${signerName || "Not signed"}`, {
        x: x + 10,
        y: blockY + signatureBlockH - 34,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });

      blockPage.drawText(
        `Signed on: ${
          signedAt
            ? new Date(signedAt).toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              })
            : "--/--/----"
        }`,
        {
          x: x + 10,
          y: blockY + signatureBlockH - 48,
          size: 9,
          font: fontRegular,
          color: COLOR_TEXT,
        }
      );

      if (!signatureData) return;

      const parsed = parseSignatureDataUri(signatureData);
      if (!parsed) return;

      const image =
        parsed.type === "png"
          ? await pdfDoc.embedPng(parsed.bytes)
          : await pdfDoc.embedJpg(parsed.bytes);

      const maxW = signatureBlockW - 20;
      const maxH = signatureBlockH - 74;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const drawW = image.width * scale;
      const drawH = image.height * scale;

      blockPage.drawImage(image, {
        x: x + 10,
        y: blockY + 14,
        width: drawW,
        height: drawH,
      });
    };

    await drawSignatureBlock(
      page,
      adminBlockX,
      "Taylor Leonard Corp",
      adminSignature?.signer_name,
      adminSignature?.signed_at,
      adminSignature?.signature_data
    );
    await drawSignatureBlock(
      page,
      clientBlockX,
      "Client",
      clientSignature?.signer_name,
      clientSignature?.signed_at,
      clientSignature?.signature_data
    );

    drawPageNumbers(pdfDoc, fontRegular);

    const pdfBytes = await pdfDoc.save();
    const filenameSafe = project.name.replace(/[^a-z0-9\-_]+/gi, "-").toLowerCase();
    const pdfBuffer = Buffer.from(pdfBytes);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameSafe || "project"}-invoice.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error exporting project PDF:", error);
    return Response.json({ error: "Failed to export project PDF" }, { status: 500 });
  }
}
