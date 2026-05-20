"use client";

import { formatCurrency } from "@/lib/estimate";
import type { EstimateEngagementSummary } from "@/lib/estimate-engagement";

interface EstimateEngagementStatusProps {
  engagement: EstimateEngagementSummary;
  formatDateTime: (dateStr: string) => string;
}

function confidenceBarClass(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 50) return "bg-amber-500";
  if (percent > 0) return "bg-sky-500";
  return "bg-(--border)";
}

function ConfidenceMeter({
  label,
  signal,
  formatDateTime,
}: {
  label: string;
  signal: EstimateEngagementSummary["email"];
  formatDateTime: (dateStr: string) => string;
}) {
  const showPercent = signal.confidencePercent > 0;

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--bg) px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-(--text)/45">
          {label}
        </p>
        {showPercent && (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-(--text)/55">
            {signal.confidencePercent}% likely
          </span>
        )}
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-(--border)"
        role="progressbar"
        aria-valuenow={signal.confidencePercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${signal.confidencePercent}% confidence`}
      >
        <div
          className={`h-full rounded-full transition-all ${confidenceBarClass(signal.confidencePercent)}`}
          style={{ width: `${Math.max(signal.confidencePercent, signal.confidencePercent > 0 ? 8 : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-(--text)">{signal.headline}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-(--text)/55">{signal.detail}</p>
      {signal.at && (
        <p className="mt-1.5 text-[10px] text-(--text)/40">{formatDateTime(signal.at)}</p>
      )}
    </div>
  );
}

export default function EstimateEngagementStatus({
  engagement,
  formatDateTime,
}: EstimateEngagementStatusProps) {
  const recipient =
    engagement.recipientName?.trim() || engagement.recipientEmail;

  return (
    <div className="mb-5 rounded-xl border border-(--border) bg-(--bg)/40 px-3 py-3 sm:px-4">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-(--text)/50">
            Client engagement
          </p>
          <p className="mt-0.5 text-[11px] text-(--text)/45">
            Sent {formatDateTime(engagement.sentAt)} · {recipient}
          </p>
        </div>
        <p className="text-xs font-medium text-(--tl-navy)">
          {formatCurrency(engagement.sentTotal)}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ConfidenceMeter
          label="Billing email"
          signal={engagement.email}
          formatDateTime={formatDateTime}
        />
        <ConfidenceMeter
          label="Estimate"
          signal={engagement.estimate}
          formatDateTime={formatDateTime}
        />
      </div>
    </div>
  );
}
