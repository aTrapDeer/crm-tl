
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import type { BonanReportStatus } from "@/lib/bonan-types";
import {
  normalizeWeeklyReportPayload,
  type WeeklyReportPayload,
  type CheckupRow,
  type SprinklerLogRow,
  type WeeklyDayRollupRow,
} from "@/lib/bonan-period-payloads";
import {
  formatUsCentralDateTime,
  formatUsCentralTime,
  getMonthKey,
} from "@/lib/us-central-time";

interface BonanWeeklyReport {
  id: string;
  report_type: "daily" | "weekly" | "monthly";
  status: BonanReportStatus;
  report_date: string;
  work_order_number?: string;
  payload: WeeklyReportPayload;
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

interface BonanMonthlyReportSummary {
  id: string;
  report_date: string;
}

type UserRole = "admin" | "employee" | "client";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function statusLabel(status: BonanReportStatus): string {
  return status === "submitted" ? "Submitted" : "Draft";
}

function statusClass(status: BonanReportStatus): string {
  return status === "submitted"
    ? "bg-green-100 text-green-700"
    : "bg-amber-100 text-amber-700";
}

function getWeekdayLabel(isoDate: string): string {
  if (!isoDate) return "";
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export default function BonanWeeklyReportEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [report, setReport] = useState<BonanWeeklyReport | null>(null);
  const [payload, setPayload] = useState<WeeklyReportPayload | null>(null);
  const [summary, setSummary] = useState<BonanCollectiveSummary | null>(null);
  const [parentMonthly, setParentMonthly] = useState<BonanMonthlyReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const isReadOnly = report?.status === "submitted" || userRole === "client";

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          router.push("/login");
          return;
        }

        setUserRole(sessionData.user.role as UserRole);

        const reportRes = await fetch(`/api/bonan/reports/${id}`);
        const reportData = await reportRes.json();
        if (!reportRes.ok) {
          setError(reportData.error || "Failed to load weekly report.");
          return;
        }

        if (reportData.report.report_type !== "weekly") {
          router.push("/dashboard/bonan/weekly");
          return;
        }

        const normalizedPayload = normalizeWeeklyReportPayload(
          reportData.report.payload,
          reportData.report.report_date
        );

        const nextReport = {
          ...(reportData.report as Omit<BonanWeeklyReport, "payload">),
          payload: normalizedPayload,
        };

        setReport(nextReport);
        setPayload(normalizedPayload);

        const [summaryRes, monthlyReportsRes] = await Promise.all([
          fetch(`/api/bonan/reports/${id}/summary`),
          fetch("/api/bonan/reports?report_type=monthly"),
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData.summary as BonanCollectiveSummary);
        }

        if (monthlyReportsRes.ok) {
          const monthlyData = await monthlyReportsRes.json();
          const reports = Array.isArray(monthlyData.reports)
            ? (monthlyData.reports as BonanMonthlyReportSummary[])
            : [];
          const targetMonth = getMonthKey(nextReport.report_date);
          const linkedMonthly = reports.find(
            (monthlyReport) => getMonthKey(monthlyReport.report_date) === targetMonth
          );
          setParentMonthly(linkedMonthly || null);
        }
      } catch (fetchError) {
        console.error("Failed to initialize weekly report editor:", fetchError);
        setError("Failed to load weekly report.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [id, router]);

  function updatePayload(updater: (current: WeeklyReportPayload) => WeeklyReportPayload) {
    setPayload((current) => {
      if (!current) return current;
      const next = updater(current);
      setDirty(true);
      setSaveMessage("Unsaved changes");
      return next;
    });
  }

  const saveDraft = useCallback(async () => {
    if (!payload || !report || isReadOnly || report.status !== "draft") return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/bonan/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          status: "draft",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save weekly report.");
        return;
      }

      const normalizedPayload = normalizeWeeklyReportPayload(data.report.payload, data.report.report_date);
      setReport({
        ...(data.report as Omit<BonanWeeklyReport, "payload">),
        payload: normalizedPayload,
      });
      setPayload(normalizedPayload);
      setDirty(false);
      setSaveMessage(`Saved at ${formatUsCentralTime(new Date())} CT`);
    } catch (saveError) {
      console.error("Failed to save weekly report:", saveError);
      setError("Failed to save weekly report.");
    } finally {
      setSaving(false);
    }
  }, [id, isReadOnly, payload, report]);

  async function submitReport() {
    if (!payload || !report || isReadOnly || report.status === "submitted") return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/bonan/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          status: "submitted",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit weekly report.");
        return;
      }

      const normalizedPayload = normalizeWeeklyReportPayload(data.report.payload, data.report.report_date);
      setReport({
        ...(data.report as Omit<BonanWeeklyReport, "payload">),
        payload: normalizedPayload,
      });
      setPayload(normalizedPayload);
      setDirty(false);
      setSaveMessage("Weekly report submitted.");
    } catch (submitError) {
      console.error("Failed to submit weekly report:", submitError);
      setError("Failed to submit weekly report.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!dirty || !payload || !report || report.status !== "draft" || isReadOnly) return;
    const timer = window.setTimeout(() => {
      void saveDraft();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [dirty, isReadOnly, payload, report, saveDraft]);

  function updateSprinklerRow<K extends keyof SprinklerLogRow>(
    rowIndex: number,
    field: K,
    value: SprinklerLogRow[K]
  ) {
    updatePayload((current) => ({
      ...current,
      sprinklerLogs: current.sprinklerLogs.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row
      ),
    }));
  }

  function updateDailyRollupRow<K extends keyof WeeklyDayRollupRow>(
    rowIndex: number,
    field: K,
    value: WeeklyDayRollupRow[K]
  ) {
    updatePayload((current) => ({
      ...current,
      dailyRollup: current.dailyRollup.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row
      ),
    }));
  }

  function updateCheckupRow<K extends keyof CheckupRow>(
    rowIndex: number,
    field: K,
    value: CheckupRow[K]
  ) {
    updatePayload((current) => ({
      ...current,
      weeklyCheckups: current.weeklyCheckups.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row
      ),
    }));
  }

  const linkedDailyByDate = useMemo(() => {
    const map = new Map<string, BonanLinkedReportSummary>();
    for (const linked of summary?.daily_reports.linked || []) {
      map.set(linked.report_date, linked);
    }
    return map;
  }, [summary]);

  const dailyCompletionPercent = useMemo(() => {
    if (!summary || summary.daily_reports.due === 0) return "0%";
    return `${Math.round((summary.daily_reports.submitted / summary.daily_reports.due) * 100)}%`;
  }, [summary]);

  const parentMonthlyPathBase = userRole === "client"
    ? "/dashboard/bonan/monthly-summaries"
    : "/dashboard/bonan/monthly";

  if (loading || !report || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-[1320px] px-3 md:px-4 py-4 md:py-5 space-y-3 md:space-y-4">
        <header className="rounded-2xl border border-(--border)/20 bg-white/90 p-3 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/bonan/weekly"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border)/30 text-(--text)/70 hover:bg-(--bg) transition"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.14em] text-(--text)/55">
                  TL Corp Maintenance Log
                </p>
              </div>
              <h1 className="text-lg md:text-2xl font-bold text-(--text) mt-1">
                Weekly - Sprinkler Pump Room Test Log
              </h1>
              <p className="text-xs text-(--text)/55 mt-1">
                Bonan Towers Operations | Week {payload.metadata.weekStart} to {payload.metadata.weekEnd}
                {report.work_order_number ? ` | WO #${report.work_order_number}` : ""}
              </p>
            </div>

            <div className="text-right">
              <span className={classNames("rounded-full px-2.5 py-1 text-[10px] font-semibold", statusClass(report.status))}>
                {statusLabel(report.status)}
              </span>
              <p className="text-[10px] text-(--text)/45 mt-1">Updated {formatUsCentralDateTime(report.updated_at)}</p>
              <p className="text-[11px] text-(--text)/55 mt-0.5">{saveMessage || " "}</p>
            </div>
          </div>

          {userRole === "client" && (
            <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
              Client review mode: this report is read-only.
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
        </header>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 p-3 md:p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-(--text)/60">Week / Date Range</span>
              <input
                value={`${payload.metadata.weekStart} to ${payload.metadata.weekEnd}`}
                readOnly
                className="w-full rounded-lg border border-(--border)/35 bg-slate-50 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Inspector</span>
              <input
                value={payload.metadata.preparedBy}
                onChange={(event) =>
                  updatePayload((current) => ({
                    ...current,
                    metadata: { ...current.metadata, preparedBy: event.target.value },
                  }))
                }
                disabled={isReadOnly}
                className="w-full rounded-lg border border-(--border)/35 bg-white px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Supervisor Review</span>
              <input
                value={payload.metadata.propertyManagerReview}
                onChange={(event) =>
                  updatePayload((current) => ({
                    ...current,
                    metadata: { ...current.metadata, propertyManagerReview: event.target.value },
                  }))
                }
                disabled={isReadOnly}
                className="w-full rounded-lg border border-(--border)/35 bg-white px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Signature</span>
              <input
                value={payload.metadata.constructionMgmtReview}
                onChange={(event) =>
                  updatePayload((current) => ({
                    ...current,
                    metadata: { ...current.metadata, constructionMgmtReview: event.target.value },
                  }))
                }
                disabled={isReadOnly}
                className="w-full rounded-lg border border-(--border)/35 bg-white px-3 py-2 disabled:bg-slate-50"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{summary?.work_orders.total ?? 0}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Work Orders</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{summary?.incidents.total ?? 0}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Incidents</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{summary?.daily_reports.submitted ?? 0}/{summary?.daily_reports.due ?? 7}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Daily Logs</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{dailyCompletionPercent}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Completion</p>
            </div>
            <div className="col-span-2 rounded-lg border border-(--border)/20 bg-slate-50 p-2 flex items-center justify-center gap-2">
              {parentMonthly ? (
                <Link
                  href={`${parentMonthlyPathBase}/${parentMonthly.id}`}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  {userRole === "client" ? "Open Parent Monthly Summary" : "Open Parent Monthly"}
                  {" "}
                  ({getMonthKey(parentMonthly.report_date)})
                </Link>
              ) : (
                <span className="text-xs text-(--text)/55">No monthly report linked for this month.</span>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Weekly Sprinkler Pump Room Test Log</h2>
            <p className="text-[11px] text-(--text)/55 mt-0.5">
              Follow manufacturer instructions and code requirements. Create a WO immediately for Level 1-2 issues.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Date</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Start/Run</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Suction PSI</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Discharge PSI</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Controller Normal (Y/N)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Alarms/Trouble (Y/N)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Notes / WO#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.sprinklerLogs.map((row, rowIndex) => (
                  <tr key={`sprinkler-${rowIndex}`}>
                    <td className="px-2.5 py-1.5">
                      <input type="date" value={row.date} onChange={(event) => updateSprinklerRow(rowIndex, "date", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <input value={row.runTime} onChange={(event) => updateSprinklerRow(rowIndex, "runTime", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <input value={row.suctionPsi} onChange={(event) => updateSprinklerRow(rowIndex, "suctionPsi", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <input value={row.dischargePsi} onChange={(event) => updateSprinklerRow(rowIndex, "dischargePsi", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.controllerNormal ? "Y" : "N"} onChange={(event) => updateSprinklerRow(rowIndex, "controllerNormal", event.target.value === "Y")} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.alarmTrouble ? "Y" : "N"} onChange={(event) => updateSprinklerRow(rowIndex, "alarmTrouble", event.target.value === "Y")} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="N">N</option>
                        <option value="Y">Y</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <input value={row.notes} onChange={(event) => updateSprinklerRow(rowIndex, "notes", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15 flex items-center justify-between gap-2">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Daily to Weekly Hyperlinked Chain</h2>
            <Link href="/dashboard/bonan/daily" className="text-xs font-semibold text-blue-700 hover:underline">Open Daily Reports</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Date</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Day</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Status</th>
                  <th className="px-2.5 py-2 text-left font-semibold">WO#</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {(summary?.daily_reports.linked || []).map((dailyReport) => (
                  <tr key={dailyReport.id}>
                    <td className="px-2.5 py-1.5">{dailyReport.report_date}</td>
                    <td className="px-2.5 py-1.5">{getWeekdayLabel(dailyReport.report_date)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass(dailyReport.status))}>{statusLabel(dailyReport.status)}</span>
                    </td>
                    <td className="px-2.5 py-1.5">{dailyReport.work_order_number || "-"}</td>
                    <td className="px-2.5 py-1.5">
                      <Link href={`/dashboard/bonan/daily/${dailyReport.id}`} className="text-blue-700 font-semibold hover:underline">Open Daily</Link>
                    </td>
                  </tr>
                ))}
                {!summary?.daily_reports.linked?.length && (
                  <tr>
                    <td colSpan={5} className="px-2.5 py-3 text-center text-(--text)/55">No daily reports linked for this week yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
            <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
              <h2 className="text-sm md:text-base font-semibold text-(--text)">Daily Walkthrough Rollup</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-xs">
                <thead className="bg-slate-100/70 text-(--text)/65">
                  <tr>
                    <th className="px-2.5 py-2 text-left font-semibold">Day</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Submitted</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Deficiencies</th>
                    <th className="px-2.5 py-2 text-left font-semibold">WO Created</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Critical</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Linked Daily</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)/12">
                  {payload.dailyRollup.map((row, rowIndex) => {
                    const linkedDate = addDaysToIsoDate(payload.metadata.weekStart, rowIndex);
                    const linkedDaily = linkedDailyByDate.get(linkedDate);
                    return (
                      <tr key={`rollup-${rowIndex}`}>
                        <td className="px-2.5 py-1.5">{row.day}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <input type="checkbox" checked={row.walkthroughSubmitted} onChange={(event) => updateDailyRollupRow(rowIndex, "walkthroughSubmitted", event.target.checked)} disabled={isReadOnly} />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input value={row.deficienciesFound} onChange={(event) => updateDailyRollupRow(rowIndex, "deficienciesFound", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input value={row.workOrdersCreated} onChange={(event) => updateDailyRollupRow(rowIndex, "workOrdersCreated", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          <input type="checkbox" checked={row.criticalFindings} onChange={(event) => updateDailyRollupRow(rowIndex, "criticalFindings", event.target.checked)} disabled={isReadOnly} />
                        </td>
                        <td className="px-2.5 py-1.5">
                          {linkedDaily ? (
                            <Link href={`/dashboard/bonan/daily/${linkedDaily.id}`} className="text-blue-700 font-semibold hover:underline">{linkedDaily.report_date}</Link>
                          ) : (
                            row.dailyReportId || "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
            <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
              <h2 className="text-sm md:text-base font-semibold text-(--text)">Weekly Checkups & Follow-up WO</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-xs">
                <thead className="bg-slate-100/70 text-(--text)/65">
                  <tr>
                    <th className="px-2.5 py-2 text-left font-semibold">Item</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Planned</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Completed</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Exceptions</th>
                    <th className="px-2.5 py-2 text-left font-semibold">WO#</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)/12">
                  {payload.weeklyCheckups.map((row, rowIndex) => (
                    <tr key={`checkup-${rowIndex}`}>
                      <td className="px-2.5 py-1.5">{row.item}</td>
                      <td className="px-2.5 py-1.5"><input value={row.planned} onChange={(event) => updateCheckupRow(rowIndex, "planned", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                      <td className="px-2.5 py-1.5"><input value={row.completed} onChange={(event) => updateCheckupRow(rowIndex, "completed", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                      <td className="px-2.5 py-1.5"><input value={row.exceptions} onChange={(event) => updateCheckupRow(rowIndex, "exceptions", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                      <td className="px-2.5 py-1.5"><input value={row.linkedWorkOrder} onChange={(event) => updateCheckupRow(rowIndex, "linkedWorkOrder", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                      <td className="px-2.5 py-1.5"><input value={row.notes} onChange={(event) => updateCheckupRow(rowIndex, "notes", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 p-3 md:p-4 space-y-2">
          <h2 className="text-sm md:text-base font-semibold text-(--text)">Collective Weekly Summary Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <label className="space-y-1">
              <span className="text-(--text)/60">Life Safety Open (L1)</span>
              <input value={payload.collectiveSummary.lifeSafetyOpen} onChange={(event) => updatePayload((current) => ({ ...current, collectiveSummary: { ...current.collectiveSummary, lifeSafetyOpen: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">High Risk Open (L2)</span>
              <input value={payload.collectiveSummary.highRiskOpen} onChange={(event) => updatePayload((current) => ({ ...current, collectiveSummary: { ...current.collectiveSummary, highRiskOpen: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Walkthrough Completion</span>
              <input value={payload.collectiveSummary.dailyWalkthroughCompletion} onChange={(event) => updatePayload((current) => ({ ...current, collectiveSummary: { ...current.collectiveSummary, dailyWalkthroughCompletion: event.target.value } }))} disabled={isReadOnly} placeholder={dailyCompletionPercent} className="w-full rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Incident Reports Filed</span>
              <input value={payload.collectiveSummary.incidentReportsFiled} onChange={(event) => updatePayload((current) => ({ ...current, collectiveSummary: { ...current.collectiveSummary, incidentReportsFiled: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </label>
          </div>
          <textarea rows={3} value={payload.collectiveSummary.notes} onChange={(event) => updatePayload((current) => ({ ...current, collectiveSummary: { ...current.collectiveSummary, notes: event.target.value } }))} disabled={isReadOnly} placeholder="Management notes / controls implemented" className="w-full rounded-lg border border-(--border)/35 px-3 py-2 text-sm disabled:bg-slate-50" />
        </section>

        {!isReadOnly && (
          <div className="flex items-center justify-between gap-2 pb-6">
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="rounded-xl border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition disabled:opacity-50">
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" onClick={() => void submitReport()} disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Weekly Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
