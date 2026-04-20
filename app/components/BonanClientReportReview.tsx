"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BonanReadOnlyData from "./BonanReadOnlyData";
import BonanClientActionPanel from "./BonanClientActionPanel";
import { getBonanDailyFieldLabel } from "@/lib/bonan-daily-formatting";

interface SummaryCard {
  label: string;
  value: string | number;
  href?: string;
}

function formatLabel(value: string) {
  const override = getBonanDailyFieldLabel([value]);
  if (override) return override;

  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSectionDescription(key: string) {
  const descriptions: Record<string, string> = {
    metadata: "Core report details, reviewer names, and submission dates.",
    coverageMatrix: "Area-by-area walkthrough results for the day.",
    commonAreas: "Shared-space condition checks and visible deficiencies.",
    riskControls: "High-risk or life-safety observations that need attention.",
    criticalWaterStructuralChecks: "Mechanical room, pump room, and boiler walkthrough readings.",
    incidents: "Events recorded during the day, including actions taken.",
    fridgeLogs: "Temperature tracking and corrective actions, if any.",
    fireAlarmEntries: "Alarm activity and related follow-up details.",
    collectiveSummary: "Roll-up notes and management summary for the review period.",
    managementNotes: "Additional context from management for the client review.",
    dailyRollup: "Day-by-day walkthrough completion and findings.",
    weeklyCheckups: "Weekly system checks and related work order follow-up.",
    sprinklerLogs: "Pump room test log and sprinkler system checks.",
    kpiSummary: "High-level performance counters and deficiency snapshot.",
    priorityWatchList: "Top items flagged for escalation or follow-up this period.",
    workOrdersCreated: "Work orders opened during this reporting window.",
    workOrdersClosed: "Work orders closed during this reporting window.",
    openCarryForward: "Open items carried into the next review period.",
    alarmEventsLog: "Fire alarm, trouble, and supervisory events for the period.",
    managementActions: "Management follow-ups planned or completed this period.",
  };

  return descriptions[key] || "Review this section carefully before signing off.";
}

function isValueEmptyForReview(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(isValueEmptyForReview);
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== "signature_data"
    );
    return entries.every(([, entryValue]) => isValueEmptyForReview(entryValue));
  }
  return false;
}

export default function BonanClientReportReview({
  reportId,
  title,
  subtitle,
  backHref,
  summaryCards = [],
  payload,
  actionArea,
  fieldOptions,
  currentFieldValues = {},
}: {
  reportId: string;
  title: string;
  subtitle: string;
  backHref: string;
  summaryCards?: SummaryCard[];
  payload: Record<string, unknown>;
  actionArea: string;
  fieldOptions: Array<{ value: string; label: string }>;
  currentFieldValues?: Record<string, string>;
}) {
  const sections = Object.entries(payload);

  const [showScrollBottom, setShowScrollBottom] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    function handleScroll() {
      if (typeof window === "undefined") return;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const maxScroll = (doc.scrollHeight || 0) - (window.innerHeight || 0);
      setShowScrollTop(scrollTop > 240);
      setShowScrollBottom(maxScroll - scrollTop > 240);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [sections.length]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const scrollToBottom = useCallback(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4f8_0%,#f8fbfd_40%,#edf2f7_100%)]">
      <div className="mx-auto w-full max-w-6xl px-3 py-5 md:px-5 md:py-8 space-y-5">
        <header className="relative overflow-hidden rounded-[32px] border border-[#0f4c81]/15 bg-[linear-gradient(135deg,#0b2f52_0%,#114a78_52%,#1b628f_100%)] shadow-[0_24px_60px_rgba(15,60,102,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_28%)]" />
          <div className="relative grid gap-5 px-4 py-5 md:grid-cols-[1.4fr_0.9fr] md:px-7 md:py-7">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                Bonan Towers Client Review
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-100/90">
                {subtitle}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={backHref}
                  className="rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Back to Reports
                </Link>
                <a
                  href="#client-actions"
                  className="rounded-full border border-cyan-100/40 bg-white px-4 py-2 text-sm font-semibold text-[#0f3c66] transition hover:bg-slate-100"
                >
                  Jump to Approval
                </a>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/15 bg-white/12 p-4 shadow-[0_20px_40px_rgba(7,23,39,0.18)] backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                How To Review
              </p>
              <div className="mt-3 space-y-2 text-sm text-white">
                <div className="rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-white/8">
                  1. Empty sections collapse automatically — tap any section to open.
                </div>
                <div className="rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-white/8">
                  2. Use the quick jump chips below to move between sections.
                </div>
                <div className="rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-white/8 text-white">
                  3. Sign if correct, or request a correction for one area only.
                </div>
              </div>
            </div>
          </div>
        </header>

        {summaryCards.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const content = (
                <div className="rounded-[26px] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.1)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {card.value}
                  </p>
                  {card.href && (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f4c81]">
                      Open details
                    </p>
                  )}
                </div>
              );

              return card.href ? (
                <Link key={`${card.label}:${card.href}`} href={card.href}>
                  {content}
                </Link>
              ) : (
                <div key={card.label}>{content}</div>
              );
            })}
          </section>
        )}

        <section className="sticky top-2 z-20 rounded-[22px] border border-slate-200/80 bg-white/95 p-3 md:p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Quick Jump
              </p>
              <h2 className="mt-0.5 text-sm font-semibold text-slate-900">
                Tap a section to jump to it
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {sections.map(([key], index) => {
                const empty = isValueEmptyForReview(payload[key]);
                return (
                  <a
                    key={key}
                    href={`#section-${key}`}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                      empty
                        ? "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        : "border-[#0f4c81]/25 bg-[#0f4c81]/8 text-[#0f4c81] hover:bg-[#0f4c81]/12"
                    }`}
                  >
                    {index + 1}. {formatLabel(key)}
                    {empty && <span className="ml-1 opacity-70">(empty)</span>}
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {sections.map(([key, value], index) => (
            <BonanReadOnlyData
              key={key}
              sectionId={`section-${key}`}
              title={key}
              value={value}
              collapsible
              stepLabel={`Step ${index + 1} of ${sections.length}`}
              description={getSectionDescription(key)}
            />
          ))}
        </div>

        <div id="client-actions" className="scroll-mt-28">
          <BonanClientActionPanel
            entityType="bonan_report"
            entityId={reportId}
            defaultArea={actionArea}
            fieldOptions={fieldOptions}
            currentFieldValues={currentFieldValues}
          />
        </div>
      </div>

      <div className="fixed bottom-4 right-3 z-40 flex flex-col gap-2 md:hidden">
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll to top"
            className="h-11 w-11 rounded-full bg-[#0b2f52] text-white shadow-[0_14px_30px_rgba(11,47,82,0.35)] ring-1 ring-white/20 flex items-center justify-center transition hover:bg-[#114a78]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
        {showScrollBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="h-11 w-11 rounded-full bg-[#0b2f52] text-white shadow-[0_14px_30px_rgba(11,47,82,0.35)] ring-1 ring-white/20 flex items-center justify-center transition hover:bg-[#114a78]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12l7 7 7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
