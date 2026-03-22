"use client";

import { createPortal } from "react-dom";

export type ModalLayerAlign = "center" | "sheet" | "sheet-sm";

type ModalLayerProps = {
  children: React.ReactNode;
  onBackdropClick?: () => void;
  /** Vertical alignment: centered dialog, bottom sheet until md/sm breakpoint, or always centered. */
  align?: ModalLayerAlign;
  /** Merged onto the backdrop (e.g. bg-black/50 backdrop-blur-sm overflow-y-auto). */
  className?: string;
};

/**
 * Full-viewport modal backdrop rendered via portal to document.body so it is not trapped
 * under dashboard layout stacking (e.g. main z-10 vs header z-40). Uses .tl-modal-backdrop
 * for z-index, 100dvh, safe areas, and scroll containment.
 */
export function ModalLayer({ children, onBackdropClick, align = "center", className = "" }: ModalLayerProps) {
  if (typeof document === "undefined") return null;

  const alignClass =
    align === "center"
      ? "tl-modal-backdrop--center"
      : align === "sheet"
        ? "tl-modal-backdrop--sheet"
        : "tl-modal-backdrop--sheet-sm";

  return createPortal(
    <div
      role="presentation"
      className={`tl-modal-backdrop ${alignClass} ${className}`.trim()}
      onClick={onBackdropClick}
    >
      {children}
    </div>,
    document.body
  );
}
