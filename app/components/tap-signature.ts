"use client";

import { formatUsCentralDateTime } from "@/lib/us-central-time";

export function getTapSignedAtLabel(date: Date = new Date()): string {
  return `${formatUsCentralDateTime(date)} CT`;
}

export function buildTapSignatureImage(
  signerName: string,
  signedAtLabel: string,
  signerTitle?: string
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 220;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const resolvedSignerName = signerName.trim() || "Signer";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#d5dce6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 130);
  ctx.lineTo(canvas.width - 40, 130);
  ctx.stroke();

  ctx.fillStyle = "#01224f";
  ctx.textBaseline = "alphabetic";
  ctx.font = '64px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
  ctx.fillText(resolvedSignerName, 42, 112, canvas.width - 84);

  ctx.fillStyle = "#334155";
  ctx.font = '20px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
  ctx.fillText(signedAtLabel, 42, 166);

  if (signerTitle) {
    ctx.fillStyle = "#64748b";
    ctx.font = '18px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    ctx.fillText(signerTitle, 42, 194, canvas.width - 84);
  }

  return canvas.toDataURL("image/png");
}
