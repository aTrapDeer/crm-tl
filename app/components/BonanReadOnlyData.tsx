"use client";

import { useState } from "react";
import {
  formatBonanDailyPrimitiveValue,
  getBonanDailyFieldLabel,
} from "@/lib/bonan-daily-formatting";

function formatLabel(value: string, path: string[] = []) {
  const override = getBonanDailyFieldLabel(path);
  if (override) return override;

  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderPrimitive(value: unknown, path: string[] = []) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const formattedBonanDailyValue = formatBonanDailyPrimitiveValue(path, value);
  if (formattedBonanDailyValue !== null) {
    return formattedBonanDailyValue || "Not provided";
  }
  return String(value);
}

function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(isValueEmpty);
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== "signature_data"
    );
    return entries.every(([, entryValue]) => isValueEmpty(entryValue));
  }
  return false;
}

function getCollectionCountLabel(value: unknown) {
  if (Array.isArray(value)) {
    return `${value.length} ${value.length === 1 ? "entry" : "entries"}`;
  }

  if (value && typeof value === "object") {
    const count = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== "signature_data"
    ).length;
    return `${count} ${count === 1 ? "item" : "items"}`;
  }

  return null;
}

function getFilledCount(value: unknown): { filled: number; total: number } | null {
  if (Array.isArray(value)) {
    const total = value.length;
    const filled = value.filter((entry) => !isValueEmpty(entry)).length;
    return { filled, total };
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== "signature_data"
    );
    const total = entries.length;
    const filled = entries.filter(([, entryValue]) => !isValueEmpty(entryValue)).length;
    return { filled, total };
  }
  return null;
}

function getEntryTitle(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `Entry ${index + 1}`;
  }

  const entry = value as Record<string, unknown>;
  const preferredKeys = [
    "day",
    "date",
    "item",
    "weekLabel",
    "reference",
    "elevator",
    "location",
    "panel",
    "area",
  ];

  for (const key of preferredKeys) {
    const candidate = entry[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return `Entry ${index + 1}`;
}

function PrimitiveField({
  label,
  value,
  path,
}: {
  label: string;
  value: unknown;
  path: string[];
}) {
  const displayValue = renderPrimitive(value, path);
  const isEmpty = displayValue === "Not provided";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-[15px] leading-6 ${
          isEmpty ? "text-slate-400" : "text-slate-800"
        }`}
      >
        {displayValue}
      </p>
    </div>
  );
}

function ValueBlock({
  value,
  level = 0,
  path = [],
}: {
  value: unknown;
  level?: number;
  path?: string[];
}) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          No entries recorded.
        </div>
      );
    }

    const primitiveOnly = value.every(
      (entry) =>
        entry === null ||
        entry === undefined ||
        typeof entry !== "object"
    );

    if (primitiveOnly) {
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {value.map((entry, index) => (
            <div
              key={`primitive-array-${index}`}
              className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Entry {index + 1}
              </p>
              <p className="mt-2 text-[15px] text-slate-800">
                {renderPrimitive(entry, [...path, String(index)])}
              </p>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {value.map((entry, index) => (
          <div
            key={`array-entry-${index}`}
            className={`rounded-[24px] border ${
              level === 0
                ? "border-slate-200 bg-white"
                : "border-slate-200/80 bg-slate-50/80"
            } p-4 md:p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Walkthrough Entry
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-900">
                  {getEntryTitle(entry, index)}
                </h4>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {index + 1}
              </span>
            </div>
            <ValueBlock value={entry} level={level + 1} path={[...path, String(index)]} />
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== "signature_data"
    );

    const primitiveEntries = entries.filter(([, entryValue]) => {
      if (Array.isArray(entryValue)) return false;
      return !entryValue || typeof entryValue !== "object";
    });
    const nestedEntries = entries.filter(([, entryValue]) => {
      if (Array.isArray(entryValue)) return true;
      return Boolean(entryValue && typeof entryValue === "object");
    });

    return (
      <div className="space-y-5">
        {primitiveEntries.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {primitiveEntries.map(([key, entryValue]) => (
              <PrimitiveField
                key={key}
                label={formatLabel(key, [...path, key])}
                value={entryValue}
                path={[...path, key]}
              />
            ))}
          </div>
        )}

        {nestedEntries.length > 0 && (
          <div className="space-y-4">
            {nestedEntries.map(([key, entryValue]) => {
              const countLabel = getCollectionCountLabel(entryValue);

              return (
                <section
                  key={key}
                  className={`rounded-[24px] border ${
                    level === 0
                      ? "border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))]"
                      : "border-slate-200/80 bg-white"
                  } p-4 md:p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]`}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Section
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-slate-900">
                        {formatLabel(key, [...path, key])}
                      </h4>
                    </div>
                    {countLabel && (
                      <span className="rounded-full bg-[#0f4c81]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f4c81]">
                        {countLabel}
                      </span>
                    )}
                  </div>
                  <ValueBlock value={entryValue} level={level + 1} path={[...path, key]} />
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[15px] leading-6 text-slate-800 whitespace-pre-wrap break-words">
        {renderPrimitive(value, path)}
      </p>
    </div>
  );
}

export default function BonanReadOnlyData({
  title,
  value,
  sectionId,
  collapsible = false,
  defaultCollapsed,
  stepLabel,
  description,
}: {
  title: string;
  value: unknown;
  sectionId?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  stepLabel?: string;
  description?: string;
}) {
  const countLabel = getCollectionCountLabel(value);
  const filledInfo = getFilledCount(value);
  const empty = isValueEmpty(value);
  const initialCollapsed = collapsible ? (defaultCollapsed ?? empty) : false;
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const headingLabel = formatLabel(title, [title]);

  return (
    <section
      id={sectionId}
      className="scroll-mt-28 rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,250,0.96))] p-4 md:p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
    >
      <button
        type="button"
        onClick={collapsible ? () => setCollapsed((value) => !value) : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
        aria-controls={sectionId ? `${sectionId}-body` : undefined}
        className={`w-full flex flex-wrap items-center justify-between gap-3 text-left ${
          collapsible ? "cursor-pointer" : "cursor-default"
        } ${!collapsed ? "border-b border-slate-200/80 pb-4 mb-5" : ""}`}
      >
        <div className="min-w-0 flex-1">
          {stepLabel && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {stepLabel}
            </p>
          )}
          {!stepLabel && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Review Section
            </p>
          )}
          <h2 className="mt-1 text-lg md:text-xl font-semibold text-slate-900">
            {headingLabel}
          </h2>
          {description && (
            <p className="mt-1 text-xs md:text-sm leading-5 text-slate-600 max-w-3xl">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {empty ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              No data
            </span>
          ) : filledInfo && filledInfo.total > 0 ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              {filledInfo.filled}/{filledInfo.total} filled
            </span>
          ) : countLabel ? (
            <span className="rounded-full bg-[#0f4c81]/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f4c81]">
              {countLabel}
            </span>
          ) : null}
          {collapsible && (
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition"
              aria-hidden="true"
            >
              <svg
                className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          )}
        </div>
      </button>
      {!collapsed && (
        <div id={sectionId ? `${sectionId}-body` : undefined}>
          <ValueBlock value={value} path={[title]} />
        </div>
      )}
    </section>
  );
}
