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
} from "@/lib/projects";

type FontType = Awaited<ReturnType<PDFDocument["embedFont"]>>;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;

const COLOR_NAVY = rgb(0.01, 0.13, 0.31);
const COLOR_TEXT = rgb(0.12, 0.12, 0.12);
const COLOR_MUTED = rgb(0.43, 0.45, 0.5);
const COLOR_LINE = rgb(0.83, 0.85, 0.89);
const COLOR_PANEL = rgb(0.96, 0.97, 0.99);

const DISCLOSURE_SECTIONS: Array<{ title: string; lines: string[] }> = [
  {
    title: "COST ESTIMATE INCLUDES",
    lines: [
      "Cost for time, materials, and equipment.",
      "Cost to prepare worksite, including protection of existing structures, finishes, materials, and components.",
      "Cost for job cleanup and debris removal at job completion.",
      "Labor setup time and mobilization time.",
    ],
  },
  {
    title: "PAYMENT TERMS",
    lines: [
      "50% due on acceptance of contract.",
      "25% due after rough-in.",
      "20% due after drywall is paint-ready.",
      "5% due after final.",
      "There may be down days due to trade scheduling and inspections outside contractor control.",
    ],
  },
  {
    title: "TIME AND MATERIAL",
    lines: [
      "Time and material items are billed at $150.00 per man, per hour, with a one-hour minimum, and collected at completion of those items.",
    ],
  },
  {
    title: "GENERAL CONDITIONS",
    lines: [
      "All work to be performed in a substantial, workmanlike manner in accordance with submitted drawings and specifications.",
      "Unless otherwise specified in contract, 50% of total amount is due at acceptance, 25% due at rough-in completion, and remaining balance, including additional work, is due at completion.",
      "Any alteration or deviation from specifications involving extra costs will be executed upon written or oral order and becomes an extra charge above this estimate.",
      "The above prices, specifications, and conditions are accepted upon authorization to proceed.",
    ],
  },
  {
    title: "DEFAULT AND COLLECTION",
    lines: [
      "Upon customer default in payment or other obligation, contractor is entitled to all sums due under contract.",
      "Contractor may recover interest at 18% per annum on unpaid sums until paid in full.",
      "Contractor is entitled to reasonable costs of enforcement and collection, including attorney fees, with or without filing suit.",
    ],
  },
  {
    title: "WARRANTY",
    lines: [
      "Contractor warrants that labor and materials furnished, and work performed, are compliant with contract documents and authorized modifications.",
      "Work is warranted against defects due to workmanship for one (1) year from date of completion/final payment.",
    ],
  },
  {
    title: "WARRANTY TERMS AND CONDITIONS",
    lines: [
      "Contractor has been paid in full for workmanship according to contract documents.",
      "Warranty does not cover damage to person or property from use of products, materials, or methods in connection with the work.",
      "Warranty is void if modifications or changes are made without prior written contractor consent.",
      "Warranty is valid only if all project close-out documents are received by contractor.",
    ],
  },
  {
    title: "EXCLUSIONS",
    lines: [
      "Damage caused by negligence, intentional misuse, or failure to properly maintain the work.",
      "Damage caused by conditions beyond contractor control, including acts of God, war, civil unrest, or governmental regulation.",
      "Changes or modifications performed by parties other than authorized contractor representatives.",
      "Damage due to cracks, crazing, mold, mildew, or other fungi.",
      "Site preparation failures, including inadequate backfill, compaction, or drainage.",
      "Costs associated with removal and/or reinstallation of work.",
    ],
  },
  {
    title: "CLAIMS",
    lines: [
      "Claims under warranty must be submitted in writing within 30 days of defect becoming apparent.",
      "Claims must include proof of purchase and photographic evidence.",
      "Contractor must be given reasonable opportunity to investigate and remedy defects.",
      "Failure to provide timely notice may void warranty.",
    ],
  },
  {
    title: "RESOLUTION",
    lines: [
      "If a problem arises, contractor has a reasonable period, not to exceed 90 days, to remedy the problem.",
      "Replacement products, if required, will be new and of similar type, quality, and function unless otherwise mutually agreed.",
    ],
  },
  {
    title: "NON-TRANSFERABLE",
    lines: [
      "Warranty is non-transferable and void if property ownership changes before warranty expiration.",
    ],
  },
  {
    title: "AGREED AND ACCEPTED",
    lines: [
      "By signing this agreement, client and contractor agree to these terms and warranty conditions.",
      "By signing this document, customer agrees to the services and conditions outlined in this document.",
    ],
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const [lineItems, estimateTotal, signatures] = await Promise.all([
      getEstimateLineItems(id),
      getEstimateTotal(id),
      getProjectSignatures(id),
    ]);

    const hideClientLineItemPricing =
      user.role === "client" && project.hide_line_item_prices_for_client;

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

    page.drawText("TAYLOR LEONARD CONSTRUCTION CORP.", {
      x: MARGIN + 64,
      y: y - 2,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    page.drawText("4717 Don Ron Drive", {
      x: MARGIN + 64,
      y: y - 16,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    page.drawText("St. Louis, MO 63123", {
      x: MARGIN + 64,
      y: y - 29,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    page.drawText("Phone: (314) 489-3229", {
      x: MARGIN + 64,
      y: y - 42,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    page.drawText("Email: taylorleonardcorp@gmail.com", {
      x: MARGIN + 64,
      y: y - 55,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
    });
    page.drawText("Web: www.TLcorp.build", {
      x: MARGIN + 64,
      y: y - 68,
      size: 9,
      font: fontRegular,
      color: COLOR_TEXT,
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

    const serviceText = project.address?.trim() || "No service address provided";
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

    const billToLines = [
      clientSignature?.signer_name || "Project Client",
      project.name,
      "St. Louis, MO",
      "United States",
    ];
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
    page.drawText(formatCurrency(estimateTotal), {
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
    page.drawText(formatCurrency(estimateTotal), {
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
