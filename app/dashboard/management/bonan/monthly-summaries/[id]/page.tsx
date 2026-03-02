"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import type { BonanReportStatus } from "@/lib/bonan-types";
import {
  normalizeMonthlyReportPayload,
  type MonthlyReportPayload,
} from "@/lib/bonan-period-payloads";
import { formatUsCentralDateTime } from "@/lib/us-central-time";

interface BonanMonthlyReport {
  id: string;
  report_type: "daily" | "weekly" | "monthly";
  status: BonanReportStatus;
  report_date: string;
  work_order_number?: string;
  payload: MonthlyReportPayload;
  updated_at: string;
  submitted_at: string | null;
}

interface BonanLinkedReportSummary {
  id: string;
  report_date: string;
  status: BonanReportStatus;
  work_order_number: string | null;
}

interface BonanCollectiveSummary {
  period_start: string;
  period_end: string;
  daily_reports: {
    due: number;
    total: number;
    submitted: number;
    linked: BonanLinkedReportSummary[];
  };
  weekly_reports: {
    total: number;
    submitted: number;
    linked: BonanLinkedReportSummary[];
  };
  incidents: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
  };
  work_orders: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
}

type UserRole = "admin" | "employee" | "client";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function statusClass(status: BonanReportStatus): string {
  return status === "submitted"
    ? "bg-green-100 text-green-700"
    : "bg-amber-100 text-amber-700";
}

function statusLabel(status: BonanReportStatus): string {
  return status === "submitted" ? "Submitted" : "Draft";
}

export default function BonanMonthlySummaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [report, setReport] = useState<BonanMonthlyReport | null>(null);
  const [payload, setPayload] = useState<MonthlyReportPayload | null>(null);
  const [summary, setSummary] = useState<BonanCollectiveSummary | null>(null);
  const [weeklySummaryById, setWeeklySummaryById] = useState<Record<string, BonanCollectiveSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          router.push("/login");
          return;
        }

        const role = sessionData.user.role as UserRole;
        setUserRole(role);

        const reportRes = await fetch(`/api/bonan/reports/${id}`);
        const reportData = await reportRes.json();
        if (!reportRes.ok) {
          setError(reportData.error || "Failed to load monthly summary.");
          return;
        }
        if (reportData.report.report_type !== "monthly") {
          router.push("/dashboard/bonan/monthly-summaries");
          return;
        }

        const normalizedPayload = normalizeMonthlyReportPayload(
          reportData.report.payload,
          reportData.report.report_date
        );
        setReport({
          ...(reportData.report as Omit<BonanMonthlyReport, "payload">),
          payload: normalizedPayload,
        });
        setPayload(normalizedPayload);

        const summaryRes = await fetch(`/api/bonan/reports/${id}/summary`);
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          const monthlySummary = summaryData.summary as BonanCollectiveSummary;
          setSummary(monthlySummary);

          if (monthlySummary.weekly_reports.linked.length > 0) {
            const results = await Promise.all(
              monthlySummary.weekly_reports.linked.map((weekly) =>
                fetch(`/api/bonan/reports/${weekly.id}/summary`)
              )
            );
            const byId: Record<string, BonanCollectiveSummary> = {};
            for (let i = 0; i < results.length; i += 1) {
              if (!results[i].ok) continue;
              const data = await results[i].json();
              byId[monthlySummary.weekly_reports.linked[i].id] = data.summary as BonanCollectiveSummary;
            }
            setWeeklySummaryById(byId);
          }
        }
      } catch (fetchError) {
        console.error("Failed to initialize monthly summary detail:", fetchError);
        setError("Failed to load monthly summary.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [id, router]);

  const dailyCompletion = useMemo(() => {
    if (!summary || summary.daily_reports.due === 0) return "0%";
    return `${Math.round((summary.daily_reports.submitted / summary.daily_reports.due) * 100)}%`;
  }, [summary]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  if (!report || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Monthly summary unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-[1320px] px-3 md:px-4 py-4 space-y-3">
        <header className="rounded-2xl border border-(--border)/20 bg-white/90 p-3 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/bonan/monthly-summaries"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border)/30 text-(--text)/70 hover:bg-(--bg) transition"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.14em] text-(--text)/55">
                  Bonan Towers Reviews
                </p>
              </div>
              <h1 className="text-lg md:text-2xl font-bold text-(--text) mt-1">
                Monthly Summary Review
              </h1>
              <p className="text-xs text-(--text)/55 mt-1">
                Month {payload.metadata.monthKey}
                {report.work_order_number ? ` | WO #${report.work_order_number}` : ""}
              </p>
            </div>

            <div className="text-right">
              <span className={classNames("rounded-full px-2.5 py-1 text-[10px] font-semibold", statusClass(report.status))}>
                {statusLabel(report.status)}
              </span>
              <p className="text-[10px] text-(--text)/45 mt-1">Updated {formatUsCentralDateTime(report.updated_at)}</p>
              {userRole !== "client" && (
                <Link href={`/dashboard/bonan/monthly/${report.id}`} className="text-xs font-semibold text-blue-700 hover:underline">
                  Open Checklist Editor
                </Link>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
        </header>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2">
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <Link href={`/dashboard/bonan/reports/${report.id}/related-items?focus=work-orders`} className="text-lg font-semibold text-blue-700 hover:underline">
                {summary?.work_orders.total ?? 0}
              </Link>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Work Orders</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <Link href={`/dashboard/bonan/reports/${report.id}/related-items?focus=incidents`} className="text-lg font-semibold text-blue-700 hover:underline">
                {summary?.incidents.total ?? 0}
              </Link>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Incidents</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{summary?.weekly_reports.submitted ?? 0}/{summary?.weekly_reports.total ?? 0}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Weekly</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{summary?.daily_reports.submitted ?? 0}/{summary?.daily_reports.due ?? 0}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Daily</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{dailyCompletion}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Completion</p>
            </div>
            <div className="rounded-lg border border-(--border)/20 bg-slate-50 p-2 text-center">
              <Link href="/dashboard/bonan/weekly" className="text-xs font-semibold text-blue-700 hover:underline">Weekly Review</Link>
              <p className="text-[10px] text-(--text)/45 mt-1">Daily links included below</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm font-semibold text-(--text)">Weekly Chain (Month Context)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Week Start</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Status</th>
                  <th className="px-2.5 py-2 text-left font-semibold">WO#</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Daily Submitted/Due</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Incidents</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Work Orders</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {(summary?.weekly_reports.linked || []).map((weekly) => {
                  const linkedSummary = weeklySummaryById[weekly.id];
                  return (
                    <tr key={weekly.id}>
                      <td className="px-2.5 py-1.5">{weekly.report_date}</td>
                      <td className="px-2.5 py-1.5">
                        <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass(weekly.status))}>
                          {statusLabel(weekly.status)}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5">{weekly.work_order_number || "-"}</td>
                      <td className="px-2.5 py-1.5">{linkedSummary ? `${linkedSummary.daily_reports.submitted}/${linkedSummary.daily_reports.due}` : "-"}</td>
                      <td className="px-2.5 py-1.5">{linkedSummary ? linkedSummary.incidents.total : "-"}</td>
                      <td className="px-2.5 py-1.5">{linkedSummary ? linkedSummary.work_orders.total : "-"}</td>
                      <td className="px-2.5 py-1.5">
                        <Link href={`/dashboard/bonan/weekly/${weekly.id}`} className="text-blue-700 font-semibold hover:underline">
                          Open Weekly
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!summary?.weekly_reports.linked?.length && (
                  <tr>
                    <td colSpan={7} className="px-2.5 py-3 text-center text-(--text)/55">No weekly reports linked this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm font-semibold text-(--text)">Daily Chain (Direct Links)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Date</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Status</th>
                  <th className="px-2.5 py-2 text-left font-semibold">WO#</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {(summary?.daily_reports.linked || []).map((daily) => (
                  <tr key={daily.id}>
                    <td className="px-2.5 py-1.5">{daily.report_date}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass(daily.status))}>
                        {statusLabel(daily.status)}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">{daily.work_order_number || "-"}</td>
                    <td className="px-2.5 py-1.5">
                      <Link href={`/dashboard/bonan/daily/${daily.id}`} className="text-blue-700 font-semibold hover:underline">
                        Open Daily
                      </Link>
                    </td>
                  </tr>
                ))}
                {!summary?.daily_reports.linked?.length && (
                  <tr>
                    <td colSpan={4} className="px-2.5 py-3 text-center text-(--text)/55">No daily reports linked this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-(--border)/20 bg-white/90 p-3">
            <h2 className="text-sm font-semibold text-(--text)">Collective Summary</h2>
            <div className="mt-2 space-y-1 text-xs">
              <p><strong>Open WO Month End:</strong> {payload.collectiveSummary.openWorkOrdersMonthEnd || "-"}</p>
              <p><strong>L1 Open:</strong> {payload.collectiveSummary.level1OpenMonthEnd || "-"}</p>
              <p><strong>L2 Open:</strong> {payload.collectiveSummary.level2OpenMonthEnd || "-"}</p>
              <p><strong>Incident Reports Filed:</strong> {payload.collectiveSummary.incidentReportsFiled || "-"}</p>
              <p><strong>Daily Completion:</strong> {payload.collectiveSummary.dailyWalkthroughCompletion || dailyCompletion}</p>
              <p><strong>Monthly Checkup Completion:</strong> {payload.collectiveSummary.monthlyCheckupCompletion || "-"}</p>
              <p className="pt-1"><strong>Notes:</strong> {payload.collectiveSummary.notes || "-"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-(--border)/20 bg-white/90 p-3">
            <h2 className="text-sm font-semibold text-(--text)">Closeout & Certification</h2>
            <div className="mt-2 space-y-1 text-xs">
              <p><strong>Prepared By:</strong> {payload.closeoutCertification.preparedBy || "-"}</p>
              <p><strong>Reviewed By:</strong> {payload.closeoutCertification.reviewedBy || "-"}</p>
              <p><strong>Certified Signature:</strong> {payload.closeoutCertification.certifiedBySignature || "-"}</p>
              <p><strong>Reviewed Signature:</strong> {payload.closeoutCertification.reviewedAcceptedSignature || "-"}</p>
              <p><strong>Checklist Complete:</strong> {Object.values(payload.closeoutChecklist).filter(Boolean).length}/6</p>
              <p><strong>Notable Events:</strong> {payload.summaryMetrics.notableEvents || "-"}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
