"use client";

interface TapInitialsControlProps {
  value: string;
  signerName: string;
  disabled?: boolean;
  signerLabel?: string;
  placeholder?: string;
  tapOnly?: boolean;
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
  const initials =
    parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();

  return initials || "IN";
}

export default function TapInitialsControl({
  value,
  signerName,
  disabled = false,
  placeholder = "Init.",
  buttonClassName = "",
  onChange,
}: TapInitialsControlProps) {
  const initials = getInitials(signerName);

  return (
    <button
      type="button"
      onClick={() => onChange(initials)}
      disabled={disabled}
      className={
        buttonClassName ||
        "w-full rounded-lg border border-(--border)/30 bg-white px-2.5 py-2 text-xs font-semibold text-(--text) transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"
      }
    >
      {value || placeholder || "Tap to initial"}
    </button>
  );
}
