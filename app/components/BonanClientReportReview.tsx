"use client";

import Link from "next/link";
import BonanReadOnlyData from "./BonanReadOnlyData";
import BonanClientActionPanel from "./BonanClientActionPanel";

interface SummaryCard {
  label: string;
  value: string | number;
  href?: string;
}

function formatLabel(value: string) {
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
  };

  return descriptions[key] || "Review this section carefully before signing off.";
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
              <div className="mt-3 space-y-3 text-sm text-white">
                <div className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/8">
                  1. Read each section from top to bottom.
                </div>
                <div className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/8">
                  2. Use the summary cards to understand totals quickly.
                </div>
                <div className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/8 text-white">
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

        <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 md:p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Walkthrough Guide
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Review one section at a time
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {sections.map(([key], index) => (
                <a
                  key={key}
                  href={`#section-${key}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-[#0f4c81]/40 hover:bg-[#0f4c81]/5 hover:text-[#0f4c81]"
                >
                  {index + 1}. {formatLabel(key)}
                </a>
              ))}
            </div>
          </div>
        </section>

        <div className="space-y-5">
          {sections.map(([key, value], index) => (
            <div key={key} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {formatLabel(key)}
                  </h2>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  {getSectionDescription(key)}
                </p>
              </div>
              <BonanReadOnlyData
                sectionId={`section-${key}`}
                title={key}
                value={value}
              />
            </div>
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
    </div>
  );
}
