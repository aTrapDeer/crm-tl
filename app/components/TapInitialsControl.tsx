"use client";

import { useState } from "react";
import ClickSignatureModal from "@/app/components/ClickSignatureModal";

interface TapInitialsControlProps {
  value: string;
  signerName: string;
  disabled?: boolean;
  signerLabel?: string;
  placeholder?: string;
  inputClassName?: string;
  buttonClassName?: string;
  onChange: (value: string) => void;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "IN";
  const initials = parts
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "IN";
}

export default function TapInitialsControl({
  value,
  signerName,
  disabled = false,
  signerLabel = "Initialed By",
  placeholder = "Init.",
  inputClassName = "",
  buttonClassName = "",
  onChange,
}: TapInitialsControlProps) {
  const [confirming, setConfirming] = useState(false);
  const initials = getInitials(signerName);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
      />
      {!disabled ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={
            buttonClassName ||
            "shrink-0 rounded-lg bg-blue-600 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
          }
        >
          {value ? "Replace" : "Initial"}
        </button>
      ) : null}
      {confirming ? (
        <ClickSignatureModal
          mode="initials"
          signerName={signerName}
          signerInitials={initials}
          signerLabel={signerLabel}
          submitLabel="Apply Initials"
          onSave={(_signatureData, _signedAtLabel, signedValue) => {
            onChange(signedValue);
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
