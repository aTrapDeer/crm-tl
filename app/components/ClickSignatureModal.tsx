"use client";

import { useMemo } from "react";
import { ModalLayer } from "@/app/components/ModalLayer";
import { formatUsCentralDateTime } from "@/lib/us-central-time";

interface ClickSignatureModalProps {
  signerName: string;
  signerTitle?: string;
  signerLabel?: string;
  submitLabel?: string;
  submitting?: boolean;
  onSave: (signatureData: string, signedAtLabel: string) => void;
  onCancel: () => void;
}

function buildSignatureImage(signerName: string, signedAtLabel: string, signerTitle?: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 220;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

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
  ctx.fillText(signerName, 42, 112, canvas.width - 84);

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

export default function ClickSignatureModal({
  signerName,
  signerTitle,
  signerLabel = "Signer",
  submitLabel = "Submit Signature",
  submitting = false,
  onSave,
  onCancel,
}: ClickSignatureModalProps) {
  const signedAtLabel = useMemo(() => `${formatUsCentralDateTime(new Date())} CT`, []);
  const resolvedSignerName = signerName.trim() || "Signer";

  function handleSubmit() {
    const signatureData = buildSignatureImage(resolvedSignerName, signedAtLabel, signerTitle);
    if (!signatureData) return;
    onSave(signatureData, signedAtLabel);
  }

  return (
    <ModalLayer align="center" className="bg-black/60" onBackdropClick={onCancel}>
      <div className="tl-card w-full max-w-lg p-6" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold text-(--text)">Confirm Signature</h3>

        <div className="mt-4 space-y-1">
          <p className="text-sm text-(--text)/65">{signerLabel}</p>
          <p className="text-base font-medium text-(--text)">{resolvedSignerName}</p>
          {signerTitle ? <p className="text-sm text-(--text)/65">{signerTitle}</p> : null}
        </div>

        <div className="mt-5 rounded-xl border border-(--border)/40 bg-white px-5 py-5">
          <p
            className="border-b border-slate-200 pb-3 text-4xl leading-tight text-[#01224f]"
            style={{ fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive' }}
          >
            {resolvedSignerName}
          </p>
          <p className="mt-3 text-xs font-medium text-slate-600">{signedAtLabel}</p>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) transition hover:bg-(--bg) disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? "Submitting..." : submitLabel}
          </button>
        </div>
      </div>
    </ModalLayer>
  );
}
