"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface SignatureCaptureProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
  signerName: string;
  signerType: "tl_corp_rep" | "building_rep";
  signerTitle?: string;
}

export default function SignatureCapture({
  onSave,
  onCancel,
  signerName,
  signerType,
  signerTitle,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get actual display size
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size accounting for device pixel ratio
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Scale context for device pixel ratio
    ctx.scale(dpr, dpr);

    // Set drawing style
    ctx.strokeStyle = "#01224f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    setupCanvas();

    // Re-setup on resize
    const handleResize = () => {
      setupCanvas();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setupCanvas]);

  function getCoordinates(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handleStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setIsDrawing(true);
    setHasSignature(true);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handleMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handleEnd() {
    setIsDrawing(false);
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSignature(false);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    // Create a temporary canvas to export at standard resolution
    const tempCanvas = document.createElement("canvas");
    const rect = canvas.getBoundingClientRect();
    tempCanvas.width = rect.width;
    tempCanvas.height = rect.height;

    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Draw the signature canvas onto the temp canvas at standard resolution
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

    const signatureData = tempCanvas.toDataURL("image/png");
    onSave(signatureData);
  }

  const signerTypeLabels = {
    tl_corp_rep: "TL Corp Representative",
    building_rep: "Building Representative",
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="tl-card p-6 w-full max-w-lg">
        <h3 className="text-lg font-semibold text-(--text) mb-4">
          Capture Signature
        </h3>

        <div className="mb-4 space-y-1">
          <p className="text-sm text-(--text)/70">
            {signerTypeLabels[signerType]}
          </p>
          <p className="text-base font-medium text-(--text)">
            {signerName}
          </p>
          {signerTitle && (
            <p className="text-sm text-(--text)/70">{signerTitle}</p>
          )}
        </div>

        <div
          ref={containerRef}
          className="border-2 border-(--border) rounded-xl bg-white mb-4 overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-48 cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        <p className="text-xs text-center text-(--text)/60 mb-4">
          Sign in the box above using your mouse or finger
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasSignature}
            className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
