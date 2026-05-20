"use client";

import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border-b border-(--border) last:border-b-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 py-4 text-left transition hover:opacity-90"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-(--text)/60">{title}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-(--text)/70">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {badge && (
            <span className="rounded-full bg-(--bg) px-2 py-0.5 text-[10px] font-medium text-(--text)/60">
              {badge}
            </span>
          )}
          <svg
            className={`h-5 w-5 text-(--text)/50 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="pb-5">{children}</div>}
    </div>
  );
}
