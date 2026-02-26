
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import type { BonanReportStatus } from "@/lib/bonan-types";
import {
  normalizeMonthlyReportPayload,
  type MonthlyReportPayload,
  type MonthlyDeficiencyRegisterRow,
  type MonthlyEmergencyLightingRow,
  type MonthlyElevatorComplianceRow,
  type MonthlyFireExtinguisherRow,
} from "@/lib/bonan-period-payloads";
import { formatUsCentralDateTime, formatUsCentralTime } from "@/lib/us-central-time";

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

function statusLabel(status: BonanReportStatus): string {
  return status === "submitted" ? "Submitted" : "Draft";
}

function statusClass(status: BonanReportStatus): string {
  return status === "submitted"
    ? "bg-green-100 text-green-700"
    : "bg-amber-100 text-amber-700";
}

export default function BonanMonthlyReportEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [report, setReport] = useState<BonanMonthlyReport | null>(null);
  const [payload, setPayload] = useState<MonthlyReportPayload | null>(null);
  const [summary, setSummary] = useState<BonanCollectiveSummary | null>(null);
  const [weeklySummaryById, setWeeklySummaryById] = useState<Record<string, BonanCollectiveSummary>>({});
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
        const role = sessionData.user.role as UserRole;
        if (role === "client") {
          router.push(`/dashboard/bonan/monthly-summaries/${id}`);
          return;
        }
        setUserRole(role);

        const reportRes = await fetch(`/api/bonan/reports/${id}`);
        const reportData = await reportRes.json();
        if (!reportRes.ok) {
          setError(reportData.error || "Failed to load monthly report.");
          return;
        }

        if (reportData.report.report_type !== "monthly") {
          router.push("/dashboard/bonan/monthly");
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
            const summaryResponses = await Promise.all(
              monthlySummary.weekly_reports.linked.map((weekly) =>
                fetch(`/api/bonan/reports/${weekly.id}/summary`)
              )
            );

            const next: Record<string, BonanCollectiveSummary> = {};
            for (let index = 0; index < summaryResponses.length; index += 1) {
              const weeklySummaryRes = summaryResponses[index];
              if (!weeklySummaryRes.ok) continue;
              const weeklySummaryData = await weeklySummaryRes.json();
              next[monthlySummary.weekly_reports.linked[index].id] = weeklySummaryData.summary as BonanCollectiveSummary;
            }
            setWeeklySummaryById(next);
          }
        }
      } catch (fetchError) {
        console.error("Failed to initialize monthly report editor:", fetchError);
        setError("Failed to load monthly report.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [id, router]);

  function updatePayload(updater: (current: MonthlyReportPayload) => MonthlyReportPayload) {
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
        body: JSON.stringify({ payload, status: "draft" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save monthly report.");
        return;
      }

      const normalizedPayload = normalizeMonthlyReportPayload(data.report.payload, data.report.report_date);
      setReport({
        ...(data.report as Omit<BonanMonthlyReport, "payload">),
        payload: normalizedPayload,
      });
      setPayload(normalizedPayload);
      setDirty(false);
      setSaveMessage(`Saved at ${formatUsCentralTime(new Date())} CT`);
    } catch (saveError) {
      console.error("Failed to save monthly report:", saveError);
      setError("Failed to save monthly report.");
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
        body: JSON.stringify({ payload, status: "submitted" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit monthly report.");
        return;
      }

      const normalizedPayload = normalizeMonthlyReportPayload(data.report.payload, data.report.report_date);
      setReport({
        ...(data.report as Omit<BonanMonthlyReport, "payload">),
        payload: normalizedPayload,
      });
      setPayload(normalizedPayload);
      setDirty(false);
      setSaveMessage("Monthly report submitted.");
    } catch (submitError) {
      console.error("Failed to submit monthly report:", submitError);
      setError("Failed to submit monthly report.");
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

  function updateFireRow<K extends keyof MonthlyFireExtinguisherRow>(index: number, field: K, value: MonthlyFireExtinguisherRow[K]) {
    updatePayload((current) => ({
      ...current,
      fireExtinguisherLog: {
        ...current.fireExtinguisherLog,
        rows: current.fireExtinguisherLog.rows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row
        ),
      },
    }));
  }

  function updateEmergencyRow<K extends keyof MonthlyEmergencyLightingRow>(index: number, field: K, value: MonthlyEmergencyLightingRow[K]) {
    updatePayload((current) => ({
      ...current,
      emergencyLightingLog: {
        ...current.emergencyLightingLog,
        rows: current.emergencyLightingLog.rows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row
        ),
      },
    }));
  }

  function updateDeficiencyRow<K extends keyof MonthlyDeficiencyRegisterRow>(index: number, field: K, value: MonthlyDeficiencyRegisterRow[K]) {
    updatePayload((current) => ({
      ...current,
      deficiencyRegister: {
        ...current.deficiencyRegister,
        rows: current.deficiencyRegister.rows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row
        ),
      },
    }));
  }

  function updateElevatorRow<K extends keyof MonthlyElevatorComplianceRow>(index: number, field: K, value: MonthlyElevatorComplianceRow[K]) {
    updatePayload((current) => ({
      ...current,
      elevatorComplianceLog: {
        ...current.elevatorComplianceLog,
        rows: current.elevatorComplianceLog.rows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row
        ),
      },
    }));
  }

  const dailyCompletionPercent = useMemo(() => {
    if (!summary || summary.daily_reports.due === 0) return "0%";
    return `${Math.round((summary.daily_reports.submitted / summary.daily_reports.due) * 100)}%`;
  }, [summary]);

  if (loading || !payload || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-[1380px] px-3 md:px-4 py-4 md:py-5 space-y-3 md:space-y-4">
        <header className="rounded-2xl border border-(--border)/20 bg-white/90 p-3 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/bonan/monthly"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-(--border)/30 text-(--text)/70 hover:bg-(--bg) transition"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.14em] text-(--text)/55">TL Corp Maintenance Log</p>
              </div>
              <h1 className="text-lg md:text-2xl font-bold text-(--text) mt-1">Monthly Work Orders Conversion & Closeout</h1>
              <p className="text-xs text-(--text)/55 mt-1">
                Bonan Towers Operations | Month {payload.metadata.monthKey}
                {report.work_order_number ? ` | WO #${report.work_order_number}` : ""}
              </p>
            </div>

            <div className="text-right">
              <span className={classNames("rounded-full px-2.5 py-1 text-[10px] font-semibold", statusClass(report.status))}>{statusLabel(report.status)}</span>
              <p className="text-[10px] text-(--text)/45 mt-1">Updated {formatUsCentralDateTime(report.updated_at)}</p>
              <p className="text-[11px] text-(--text)/55 mt-0.5">{saveMessage || " "}</p>
              {userRole === "admin" && (
                <Link href={`/dashboard/bonan/monthly-summaries/${report.id}`} className="text-xs font-semibold text-blue-700 hover:underline">
                  Open Summary View
                </Link>
              )}
            </div>
          </div>

          {userRole === "client" && (
            <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">Client review mode: this report is read-only.</p>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
          )}
        </header>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 p-3 md:p-4 space-y-3">
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
              <p className="text-lg font-semibold text-(--text)">{summary?.weekly_reports.submitted ?? 0}/{summary?.weekly_reports.total ?? 0}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Weekly</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{summary?.daily_reports.submitted ?? 0}/{summary?.daily_reports.due ?? 0}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Daily</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">{dailyCompletionPercent}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Completion</p>
            </div>
            <div className="rounded-lg border border-(--border)/20 bg-slate-50 p-2 flex items-center justify-center gap-3">
              <Link href="/dashboard/bonan/weekly" className="text-xs font-semibold text-blue-700 hover:underline">Weekly</Link>
              <Link href="/dashboard/bonan/daily" className="text-xs font-semibold text-blue-700 hover:underline">Daily</Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Weekly to Monthly Hyperlinked Chain</h2>
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
                {(summary?.weekly_reports.linked || []).map((weeklyReport) => {
                  const linkedSummary = weeklySummaryById[weeklyReport.id];
                  return (
                    <tr key={weeklyReport.id}>
                      <td className="px-2.5 py-1.5">{weeklyReport.report_date}</td>
                      <td className="px-2.5 py-1.5"><span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass(weeklyReport.status))}>{statusLabel(weeklyReport.status)}</span></td>
                      <td className="px-2.5 py-1.5">{weeklyReport.work_order_number || "-"}</td>
                      <td className="px-2.5 py-1.5">{linkedSummary ? `${linkedSummary.daily_reports.submitted}/${linkedSummary.daily_reports.due}` : "-"}</td>
                      <td className="px-2.5 py-1.5">{linkedSummary ? linkedSummary.incidents.total : "-"}</td>
                      <td className="px-2.5 py-1.5">{linkedSummary ? linkedSummary.work_orders.total : "-"}</td>
                      <td className="px-2.5 py-1.5"><Link href={`/dashboard/bonan/weekly/${weeklyReport.id}`} className="text-blue-700 font-semibold hover:underline">Open Weekly</Link></td>
                    </tr>
                  );
                })}
                {!summary?.weekly_reports.linked?.length && (
                  <tr>
                    <td colSpan={7} className="px-2.5 py-3 text-center text-(--text)/55">No weekly reports linked for this month yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Daily Reports Linked to This Month</h2>
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
                    <td className="px-2.5 py-1.5">{new Date(`${dailyReport.report_date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass(dailyReport.status))}>
                        {statusLabel(dailyReport.status)}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">{dailyReport.work_order_number || "-"}</td>
                    <td className="px-2.5 py-1.5">
                      <Link href={`/dashboard/bonan/daily/${dailyReport.id}`} className="text-blue-700 font-semibold hover:underline">
                        Open Daily
                      </Link>
                    </td>
                  </tr>
                ))}
                {!summary?.daily_reports.linked?.length && (
                  <tr>
                    <td colSpan={5} className="px-2.5 py-3 text-center text-(--text)/55">No daily reports linked for this month yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Monthly - Fire Extinguisher Visual Inspection Log</h2>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs border-b border-(--border)/15">
            <input value={payload.fireExtinguisherLog.monthYear} onChange={(event) => updatePayload((current) => ({ ...current, fireExtinguisherLog: { ...current.fireExtinguisherLog, monthYear: event.target.value } }))} disabled={isReadOnly} placeholder="Month / Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.fireExtinguisherLog.inspector} onChange={(event) => updatePayload((current) => ({ ...current, fireExtinguisherLog: { ...current.fireExtinguisherLog, inspector: event.target.value } }))} disabled={isReadOnly} placeholder="Inspector" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.fireExtinguisherLog.supervisorReview} onChange={(event) => updatePayload((current) => ({ ...current, fireExtinguisherLog: { ...current.fireExtinguisherLog, supervisorReview: event.target.value } }))} disabled={isReadOnly} placeholder="Supervisor Review" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.fireExtinguisherLog.signature} onChange={(event) => updatePayload((current) => ({ ...current, fireExtinguisherLog: { ...current.fireExtinguisherLog, signature: event.target.value } }))} disabled={isReadOnly} placeholder="Signature" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Extinguisher ID / Location</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Gauge (Y/N)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Pin/Seal (Y/N)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Accessible (Y/N)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Condition (O/D)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Init.</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Notes / WO#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.fireExtinguisherLog.rows.map((row, rowIndex) => (
                  <tr key={`fire-${rowIndex}`}>
                    <td className="px-2.5 py-1.5"><input value={row.extinguisherIdLocation} onChange={(event) => updateFireRow(rowIndex, "extinguisherIdLocation", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.gauge} onChange={(event) => updateFireRow(rowIndex, "gauge", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.pinSeal} onChange={(event) => updateFireRow(rowIndex, "pinSeal", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.accessible} onChange={(event) => updateFireRow(rowIndex, "accessible", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.condition} onChange={(event) => updateFireRow(rowIndex, "condition", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.initials} onChange={(event) => updateFireRow(rowIndex, "initials", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.notesWorkOrder} onChange={(event) => updateFireRow(rowIndex, "notesWorkOrder", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Monthly - Emergency Lighting & Exit Sign Test Log</h2>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs border-b border-(--border)/15">
            <input value={payload.emergencyLightingLog.monthYear} onChange={(event) => updatePayload((current) => ({ ...current, emergencyLightingLog: { ...current.emergencyLightingLog, monthYear: event.target.value } }))} disabled={isReadOnly} placeholder="Month / Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.emergencyLightingLog.inspector} onChange={(event) => updatePayload((current) => ({ ...current, emergencyLightingLog: { ...current.emergencyLightingLog, inspector: event.target.value } }))} disabled={isReadOnly} placeholder="Inspector" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.emergencyLightingLog.supervisorReview} onChange={(event) => updatePayload((current) => ({ ...current, emergencyLightingLog: { ...current.emergencyLightingLog, supervisorReview: event.target.value } }))} disabled={isReadOnly} placeholder="Supervisor Review" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.emergencyLightingLog.signature} onChange={(event) => updatePayload((current) => ({ ...current, emergencyLightingLog: { ...current.emergencyLightingLog, signature: event.target.value } }))} disabled={isReadOnly} placeholder="Signature" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Date</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Area / Device</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Duration</th>
                  <th className="px-2.5 py-2 text-left font-semibold">P/F</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Corrective Action / WO#</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Init.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.emergencyLightingLog.rows.map((row, rowIndex) => (
                  <tr key={`light-${rowIndex}`}>
                    <td className="px-2.5 py-1.5"><input type="date" value={row.date} onChange={(event) => updateEmergencyRow(rowIndex, "date", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.areaDevice} onChange={(event) => updateEmergencyRow(rowIndex, "areaDevice", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.duration} onChange={(event) => updateEmergencyRow(rowIndex, "duration", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.passFail} onChange={(event) => updateEmergencyRow(rowIndex, "passFail", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.correctiveActionWorkOrder} onChange={(event) => updateEmergencyRow(rowIndex, "correctiveActionWorkOrder", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.initials} onChange={(event) => updateEmergencyRow(rowIndex, "initials", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Monthly Deficiency Register & Open Work Orders</h2>
          </div>
          <div className="p-3 md:p-4 space-y-2 text-xs border-b border-(--border)/15">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={payload.deficiencyRegister.monthYear} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, monthYear: event.target.value } }))} disabled={isReadOnly} placeholder="Month / Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.preparedBy} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, preparedBy: event.target.value } }))} disabled={isReadOnly} placeholder="Prepared By" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.supervisorReview} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, supervisorReview: event.target.value } }))} disabled={isReadOnly} placeholder="Supervisor Review" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.signature} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, signature: event.target.value } }))} disabled={isReadOnly} placeholder="Signature" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
              <input value={payload.deficiencyRegister.totalOpenStart} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, totalOpenStart: event.target.value } }))} disabled={isReadOnly} placeholder="Total Open (Start)" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.newThisMonth} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, newThisMonth: event.target.value } }))} disabled={isReadOnly} placeholder="New This Month" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.closedThisMonth} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, closedThisMonth: event.target.value } }))} disabled={isReadOnly} placeholder="Closed This Month" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.openEnd} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, openEnd: event.target.value } }))} disabled={isReadOnly} placeholder="Open (End)" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.level1} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level1: event.target.value } }))} disabled={isReadOnly} placeholder="Level 1" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.level2} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level2: event.target.value } }))} disabled={isReadOnly} placeholder="Level 2" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.level3} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level3: event.target.value } }))} disabled={isReadOnly} placeholder="Level 3" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.level4} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level4: event.target.value } }))} disabled={isReadOnly} placeholder="Level 4" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">WO#</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Lvl</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Opened</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Area/Location</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Description / Next Action</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Target</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.deficiencyRegister.rows.map((row, rowIndex) => (
                  <tr key={`def-${rowIndex}`}>
                    <td className="px-2.5 py-1.5"><input value={row.workOrderNumber} onChange={(event) => updateDeficiencyRow(rowIndex, "workOrderNumber", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.level} onChange={(event) => updateDeficiencyRow(rowIndex, "level", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.opened} onChange={(event) => updateDeficiencyRow(rowIndex, "opened", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.areaLocation} onChange={(event) => updateDeficiencyRow(rowIndex, "areaLocation", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.descriptionNextAction} onChange={(event) => updateDeficiencyRow(rowIndex, "descriptionNextAction", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.target} onChange={(event) => updateDeficiencyRow(rowIndex, "target", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.status} onChange={(event) => updateDeficiencyRow(rowIndex, "status", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:p-4 space-y-2 text-xs border-t border-(--border)/15">
            <textarea rows={3} value={payload.deficiencyRegister.managementNotes} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, managementNotes: event.target.value } }))} disabled={isReadOnly} placeholder="Management Notes / Risk Controls Implemented" className="w-full rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input value={payload.deficiencyRegister.ownerExecutiveReview} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, ownerExecutiveReview: event.target.value } }))} disabled={isReadOnly} placeholder="Owner/Executive Review" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.ownerExecutiveDate} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, ownerExecutiveDate: event.target.value } }))} disabled={isReadOnly} placeholder="Date" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Elevator Monthly Compliance & Functional Log</h2>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs border-b border-(--border)/15">
            <input value={payload.elevatorComplianceLog.monthYear} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, monthYear: event.target.value } }))} disabled={isReadOnly} placeholder="Month / Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.inspector} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, inspector: event.target.value } }))} disabled={isReadOnly} placeholder="Inspector" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.vendorServiceDate} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, vendorServiceDate: event.target.value } }))} disabled={isReadOnly} placeholder="Vendor Service Date" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.workOrderNumber} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, workOrderNumber: event.target.value } }))} disabled={isReadOnly} placeholder="WO# (if any)" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Elevator</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Permit (Y/N)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Ride/Doors (O/D)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Alarm (Y/N)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Phone (P/F)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Cab (O/D)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Notes/WO#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.elevatorComplianceLog.rows.map((row, rowIndex) => (
                  <tr key={`elev-${rowIndex}`}>
                    <td className="px-2.5 py-1.5">{row.elevator}</td>
                    <td className="px-2.5 py-1.5"><input value={row.permit} onChange={(event) => updateElevatorRow(rowIndex, "permit", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.rideDoors} onChange={(event) => updateElevatorRow(rowIndex, "rideDoors", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.alarm} onChange={(event) => updateElevatorRow(rowIndex, "alarm", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.phone} onChange={(event) => updateElevatorRow(rowIndex, "phone", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.cab} onChange={(event) => updateElevatorRow(rowIndex, "cab", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.notesWorkOrder} onChange={(event) => updateElevatorRow(rowIndex, "notesWorkOrder", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs border-t border-(--border)/15">
            <input value={payload.elevatorComplianceLog.northCar1Expiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, northCar1Expiration: event.target.value } }))} disabled={isReadOnly} placeholder="North Car 1 Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.northCar2Expiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, northCar2Expiration: event.target.value } }))} disabled={isReadOnly} placeholder="North Car 2 Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.southCar1Expiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, southCar1Expiration: event.target.value } }))} disabled={isReadOnly} placeholder="South Car 1 Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.southCar2Expiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, southCar2Expiration: event.target.value } }))} disabled={isReadOnly} placeholder="South Car 2 Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <textarea value={payload.elevatorComplianceLog.notesCorrectiveActions} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, notesCorrectiveActions: event.target.value } }))} disabled={isReadOnly} placeholder="Notes / Corrective Actions" className="md:col-span-2 rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" rows={3} />
          </div>
        </section>

        <section className="rounded-2xl border border-(--border)/20 bg-white/90 overflow-hidden">
          <div className="px-3 md:px-4 py-2.5 border-b border-(--border)/15">
            <h2 className="text-sm md:text-base font-semibold text-(--text)">Monthly Closeout & Filing Certification</h2>
          </div>
          <div className="p-3 md:p-4 space-y-2 text-xs border-b border-(--border)/15">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={payload.closeoutCertification.month} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, month: event.target.value } }))} disabled={isReadOnly} placeholder="Month" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.closeoutCertification.year} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, year: event.target.value } }))} disabled={isReadOnly} placeholder="Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.closeoutCertification.preparedBy} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, preparedBy: event.target.value } }))} disabled={isReadOnly} placeholder="Prepared By" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.closeoutCertification.reviewedBy} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, reviewedBy: event.target.value } }))} disabled={isReadOnly} placeholder="Reviewed By (Supervisor/PM)" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={payload.closeoutCertification.title} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, title: event.target.value } }))} disabled={isReadOnly} placeholder="Title" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.closeoutCertification.datePrepared} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, datePrepared: event.target.value } }))} disabled={isReadOnly} placeholder="Date Prepared" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.closeoutCertification.dateReviewed} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, dateReviewed: event.target.value } }))} disabled={isReadOnly} placeholder="Date Reviewed" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.closeoutCertification.binderTab} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, binderTab: event.target.value } }))} disabled={isReadOnly} placeholder="Binder Tab" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </div>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs border-b border-(--border)/15">
            {([
              ["dailyWalkthroughLogsCompleted", "Daily walk-through logs completed and filed"],
              ["dailyCriticalChecksCompleted", "Daily critical systems checks completed and filed"],
              ["weeklySprinklerLogsCompleted", "Weekly sprinkler pump room logs completed"],
              ["incidentReportsFiled", "Incident reports documented and filed"],
              ["deficiencyRegisterUpdated", "Monthly deficiency register updated"],
              ["openWorkOrdersReviewed", "Open work orders reviewed and prioritized"],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2">
                <input type="checkbox" checked={payload.closeoutChecklist[field]} onChange={(event) => updatePayload((current) => ({ ...current, closeoutChecklist: { ...current.closeoutChecklist, [field]: event.target.checked } }))} disabled={isReadOnly} />
                {label}
              </label>
            ))}
          </div>
          <div className="overflow-x-auto border-b border-(--border)/15">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Metric</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Value / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {([
                  ["totalWorkOrdersOpened", "Total Work Orders Opened"],
                  ["totalWorkOrdersClosed", "Total Work Orders Closed"],
                  ["workOrdersRemainingOpen", "Work Orders Remaining Open (end of month)"],
                  ["level1Count", "Level 1 Count"],
                  ["level2Count", "Level 2 Count"],
                  ["level3Count", "Level 3 Count"],
                  ["level4Count", "Level 4 Count"],
                  ["notableEvents", "Notable Events / Incidents"],
                ] as const).map(([field, label]) => (
                  <tr key={field}>
                    <td className="px-2.5 py-1.5">{label}</td>
                    <td className="px-2.5 py-1.5">
                      <input value={payload.summaryMetrics[field]} onChange={(event) => updatePayload((current) => ({ ...current, summaryMetrics: { ...current.summaryMetrics, [field]: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <input value={payload.closeoutCertification.certifiedBySignature} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, certifiedBySignature: event.target.value } }))} disabled={isReadOnly} placeholder="Certified By (Signature)" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.closeoutCertification.certifiedDate} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, certifiedDate: event.target.value } }))} disabled={isReadOnly} placeholder="Date" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.closeoutCertification.reviewedAcceptedSignature} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, reviewedAcceptedSignature: event.target.value } }))} disabled={isReadOnly} placeholder="Reviewed/Accepted By" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.closeoutCertification.reviewedAcceptedDate} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, reviewedAcceptedDate: event.target.value } }))} disabled={isReadOnly} placeholder="Date" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
          </div>
        </section>

        {!isReadOnly && (
          <div className="flex items-center justify-between gap-2 pb-6">
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="rounded-xl border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition disabled:opacity-50">
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" onClick={() => void submitReport()} disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Monthly Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
