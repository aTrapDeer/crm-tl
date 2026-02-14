import { cookies } from "next/headers";
import { join } from "path";
import { readFile } from "fs/promises";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getProjectsByUserId,
  getEstimateLineItems,
  getEstimateTotal,
  getProjectSignatures,
} from "@/lib/projects";

type FontType = Awaited<ReturnType<PDFDocument["embedFont"]>>;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

function parseSignatureDataUri(dataUri: string): { bytes: Uint8Array; type: "png" | "jpg" } | null {
  const match = dataUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) return null;

  const type = match[1] === "png" ? "png" : "jpg";
  const bytes = Buffer.from(match[2], "base64");
  return { bytes, type };
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
      const isAssigned = assignedProjects.some((p) => p.id === id);
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

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const logoPath = join(process.cwd(), "public", "NoTextLogoFIXED.png");
    const logoBytes = await readFile(logoPath);
    const logo = await pdfDoc.embedPng(logoBytes);

    let page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const margin = 48;
    let y = height - margin;

    page.drawRectangle({
      x: 0,
      y: height - 120,
      width,
      height: 120,
      color: rgb(0.01, 0.13, 0.31),
    });

    const logoDims = logo.scale(0.2);
    page.drawImage(logo, {
      x: margin,
      y: height - 95,
      width: logoDims.width,
      height: logoDims.height,
    });

    page.drawText("Taylor Leonard Corp", {
      x: margin + 90,
      y: height - 55,
      size: 20,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("Project Estimate Summary", {
      x: margin + 90,
      y: height - 78,
      size: 12,
      font: fontRegular,
      color: rgb(0.85, 0.92, 1),
    });
    page.drawText(new Date().toLocaleDateString("en-US"), {
      x: width - margin - 100,
      y: height - 55,
      size: 11,
      font: fontRegular,
      color: rgb(0.85, 0.92, 1),
    });

    y = height - 150;

    const detailLines = [
      `Project: ${project.name}`,
      `Status: ${project.status.replace("_", " ")}`,
      `Address: ${project.address || "N/A"}`,
      `Description: ${project.description || "N/A"}`,
    ];
    detailLines.forEach((line) => {
      const wrapped = wrapText(line, width - margin * 2, fontRegular, 11);
      wrapped.forEach((wrappedLine) => {
        page.drawText(wrappedLine, {
          x: margin,
          y,
          size: 11,
          font: fontRegular,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= 16;
      });
    });

    y -= 10;
    page.drawText("Line Items", {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.01, 0.13, 0.31),
    });
    y -= 22;

    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: width - margin * 2,
      height: 20,
      color: rgb(0.94, 0.96, 0.99),
    });

    page.drawText("Category", { x: margin + 6, y: y - 11, size: 10, font: fontBold });
    page.drawText("Description", { x: margin + 120, y: y - 11, size: 10, font: fontBold });
    page.drawText("Qty", { x: width - margin - 190, y: y - 11, size: 10, font: fontBold });
    page.drawText("Rate", { x: width - margin - 130, y: y - 11, size: 10, font: fontBold });
    page.drawText("Total", { x: width - margin - 70, y: y - 11, size: 10, font: fontBold });
    y -= 28;

    for (const item of lineItems) {
      if (y < 120) {
        y = 700;
        page = pdfDoc.addPage([612, 792]);
        page.drawText("Line Items (continued)", {
          x: margin,
          y: 740,
          size: 12,
          font: fontBold,
        });
      }

      const categoryLabel =
        item.category === "custom" ? item.custom_category_name || "Custom" : item.category;
      const description = item.description || "-";
      const descriptionLines = wrapText(description, 240, fontRegular, 9);

      page.drawText(categoryLabel.slice(0, 18), {
        x: margin + 6,
        y,
        size: 9,
        font: fontRegular,
      });

      page.drawText(descriptionLines[0], {
        x: margin + 120,
        y,
        size: 9,
        font: fontRegular,
      });

      page.drawText(String(item.quantity), {
        x: width - margin - 190,
        y,
        size: 9,
        font: fontRegular,
      });
      page.drawText(formatCurrency(item.price_rate), {
        x: width - margin - 130,
        y,
        size: 9,
        font: fontRegular,
      });
      page.drawText(formatCurrency(item.total), {
        x: width - margin - 70,
        y,
        size: 9,
        font: fontBold,
      });

      y -= 14;
      for (let i = 1; i < descriptionLines.length; i++) {
        page.drawText(descriptionLines[i], {
          x: margin + 120,
          y,
          size: 9,
          font: fontRegular,
        });
        y -= 12;
      }
      y -= 4;
    }

    y -= 8;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.74, 0.8),
    });
    y -= 18;

    page.drawText("Estimate Total", {
      x: width - margin - 180,
      y,
      size: 13,
      font: fontBold,
      color: rgb(0.01, 0.13, 0.31),
    });
    page.drawText(formatCurrency(estimateTotal), {
      x: width - margin - 80,
      y,
      size: 13,
      font: fontBold,
      color: rgb(0.01, 0.13, 0.31),
    });

    y -= 42;
    page.drawText("Digital Signatures", {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.01, 0.13, 0.31),
    });
    y -= 20;

    const signatureOrder: Array<{ role: "admin" | "client"; label: string }> = [
      { role: "admin", label: "Admin Approval" },
      { role: "client", label: "Client Approval" },
    ];

    for (const signatureRole of signatureOrder) {
      const signature = signatures.find((s) => s.signer_role === signatureRole.role);
      page.drawText(signatureRole.label, {
        x: margin,
        y,
        size: 11,
        font: fontBold,
      });
      y -= 16;

      if (!signature) {
        page.drawText("Not signed", {
          x: margin,
          y,
          size: 10,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        });
        y -= 18;
        continue;
      }

      page.drawText(`Signed by: ${signature.signer_name}`, {
        x: margin,
        y,
        size: 10,
        font: fontRegular,
      });
      y -= 14;
      page.drawText(
        `Signed at: ${new Date(signature.signed_at).toLocaleString("en-US")}`,
        {
          x: margin,
          y,
          size: 10,
          font: fontRegular,
        }
      );
      y -= 14;

      const parsed = parseSignatureDataUri(signature.signature_data);
      if (parsed) {
        const image =
          parsed.type === "png"
            ? await pdfDoc.embedPng(parsed.bytes)
            : await pdfDoc.embedJpg(parsed.bytes);
        const dims = image.scale(0.3);
        page.drawImage(image, {
          x: margin,
          y: y - dims.height + 8,
          width: dims.width,
          height: dims.height,
        });
        y -= Math.max(dims.height, 28);
      } else {
        y -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const filenameSafe = project.name.replace(/[^a-z0-9\-_]+/gi, "-").toLowerCase();

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameSafe || "project"}-summary.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error exporting project PDF:", error);
    return Response.json({ error: "Failed to export project PDF" }, { status: 500 });
  }
}
