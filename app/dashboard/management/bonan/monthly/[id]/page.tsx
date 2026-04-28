
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
import ClickSignatureModal from "@/app/components/ClickSignatureModal";

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
    emergency: number;
    high: number;
    normal: number;
    low: number;
  };
  material_costs: {
    total: number;
    work_orders: number;
    incident_reports: number;
    legacy_work_orders: number;
  };
}

type UserRole = "admin" | "employee" | "client";
type MonthlySignatureTarget =
  | "fire_extinguisher"
  | "emergency_lighting"
  | "deficiency"
  | "board_approval"
  | "certified_by"
  | "reviewed_accepted";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function countRowsWithValues<T extends object>(
  rows: T[],
  keys: Array<keyof T>
): number {
  return rows.filter((row) => keys.some((key) => hasText(row[key] as string | null | undefined))).length;
}

function getDeficiencyPriorityBucket(level: string): "1" | "2" | "3" | "4" | null {
  const normalized = level.trim().toLowerCase();
  if (
    normalized === "1" ||
    normalized === "l1" ||
    normalized === "level 1" ||
    normalized === "priority - low" ||
    normalized === "priority low" ||
    normalized === "low"
  ) {
    return "1";
  }
  if (
    normalized === "2" ||
    normalized === "l2" ||
    normalized === "level 2" ||
    normalized === "priority - moderate" ||
    normalized === "priority moderate" ||
    normalized === "moderate" ||
    normalized === "normal"
  ) {
    return "2";
  }
  if (
    normalized === "3" ||
    normalized === "l3" ||
    normalized === "level 3" ||
    normalized === "priority - immediate" ||
    normalized === "priority immediate" ||
    normalized === "immediate" ||
    normalized === "high"
  ) {
    return "3";
  }
  if (
    normalized === "4" ||
    normalized === "l4" ||
    normalized === "level 4" ||
    normalized === "board approval level" ||
    normalized === "board approval" ||
    normalized === "emergency"
  ) {
    return "4";
  }
  return null;
}

function statusLabel(status: BonanReportStatus): string {
  return status === "submitted" ? "Submitted" : "Draft";
}

function statusClass(status: BonanReportStatus): string {
  return status === "submitted"
    ? "bg-green-100 text-green-700"
    : "bg-amber-100 text-amber-700";
}

const FIRE_GAUGE_OPTIONS = ["Green", "Yellow", "Red"] as const;
const FIRE_PASS_FAIL_OPTIONS = ["Pass", "Fail"] as const;
const FIRE_YES_NO_OPTIONS = ["Yes", "No"] as const;
const DEFICIENCY_PRIORITY_OPTIONS = [
  "Priority - Low",
  "Priority - Moderate",
  "Priority - Immediate",
  "Board Approval Level",
] as const;

const SECTION_TONES = {
  overview: {
    shell: "border-slate-300/60 bg-linear-to-br from-white via-slate-50 to-slate-100/80 shadow-sm",
    header: "border-slate-300/60 bg-slate-900 text-white",
  },
  chain: {
    shell: "border-blue-200/80 bg-linear-to-br from-blue-50/90 via-white to-sky-50/80 shadow-sm",
    header: "border-blue-300/50 bg-blue-900 text-blue-50",
  },
  fire: {
    shell: "border-emerald-200/90 bg-linear-to-br from-emerald-50/90 via-white to-green-50/70 shadow-sm",
    header: "border-emerald-300/50 bg-emerald-900 text-emerald-50",
  },
  emergency: {
    shell: "border-amber-200/90 bg-linear-to-br from-amber-50/90 via-white to-yellow-50/70 shadow-sm",
    header: "border-amber-300/50 bg-amber-900 text-amber-50",
  },
  deficiency: {
    shell: "border-rose-200/90 bg-linear-to-br from-rose-50/90 via-white to-orange-50/70 shadow-sm",
    header: "border-rose-300/50 bg-rose-900 text-rose-50",
  },
  elevator: {
    shell: "border-cyan-200/90 bg-linear-to-br from-cyan-50/90 via-white to-sky-50/70 shadow-sm",
    header: "border-cyan-300/50 bg-cyan-900 text-cyan-50",
  },
  closeout: {
    shell: "border-indigo-200/90 bg-linear-to-br from-indigo-50/90 via-white to-slate-50/70 shadow-sm",
    header: "border-indigo-300/50 bg-indigo-900 text-indigo-50",
  },
  outlook: {
    shell: "border-violet-200/80 bg-linear-to-br from-fuchsia-50/80 via-white to-violet-50/80 shadow-sm",
    header: "border-violet-300/50 bg-violet-900 text-violet-50",
  },
} as const;

function getPriorityCounts(
  summary: BonanCollectiveSummary | null,
  payload: MonthlyReportPayload
) {
  const fallback = payload.deficiencyRegister.rows.reduce(
    (counts, row) => {
      const bucket = getDeficiencyPriorityBucket(row.level);
      if (bucket) counts[bucket] += 1;
      return counts;
    },
    { "1": 0, "2": 0, "3": 0, "4": 0 }
  );

  return {
    low: summary?.work_orders.low ?? fallback["1"],
    moderate: summary?.work_orders.normal ?? fallback["2"],
    immediate: summary?.work_orders.high ?? fallback["3"],
    boardApproval: summary?.work_orders.emergency ?? fallback["4"],
  };
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
  const [currentUserName, setCurrentUserName] = useState("Signer");
  const [showSignaturePrompt, setShowSignaturePrompt] = useState<MonthlySignatureTarget | null>(null);

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
        setCurrentUserName(
          `${sessionData.user.first_name || ""} ${sessionData.user.last_name || ""}`.trim() || "Signer"
        );
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

  function applyEmployeeSignature(_signatureData: string, signedAtLabel: string) {
    if (!showSignaturePrompt) return;
    const stampedSignature = `${currentUserName} - ${signedAtLabel}`;

    updatePayload((current) => {
      if (showSignaturePrompt === "fire_extinguisher") {
        return {
          ...current,
          fireExtinguisherLog: { ...current.fireExtinguisherLog, signature: stampedSignature },
        };
      }
      if (showSignaturePrompt === "emergency_lighting") {
        return {
          ...current,
          emergencyLightingLog: { ...current.emergencyLightingLog, signature: stampedSignature },
        };
      }
      if (showSignaturePrompt === "deficiency") {
        return {
          ...current,
          deficiencyRegister: { ...current.deficiencyRegister, signature: stampedSignature },
        };
      }
      if (showSignaturePrompt === "board_approval") {
        return {
          ...current,
          deficiencyRegister: {
            ...current.deficiencyRegister,
            ownerExecutiveReview: stampedSignature,
            ownerExecutiveDate: signedAtLabel,
          },
        };
      }
      if (showSignaturePrompt === "certified_by") {
        return {
          ...current,
          closeoutCertification: {
            ...current.closeoutCertification,
            certifiedBySignature: stampedSignature,
            certifiedDate: signedAtLabel,
          },
        };
      }
      return {
        ...current,
        closeoutCertification: {
          ...current.closeoutCertification,
          reviewedAcceptedSignature: stampedSignature,
          reviewedAcceptedDate: signedAtLabel,
        },
      };
    });
    setShowSignaturePrompt(null);
  }

  function renderSignatureControl(target: MonthlySignatureTarget, value: string, emptyLabel = "No signature recorded") {
    const [name, ...dateParts] = value.split(" - ");
    return (
      <div className="space-y-1">
        {value ? (
          <div className="rounded border border-(--border)/35 bg-white px-2 py-1.5">
            <p
              className="text-2xl leading-tight text-[#01224f]"
              style={{ fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive' }}
            >
              {name}
            </p>
            <p className="mt-0.5 text-[11px] text-(--text)/55">{dateParts.join(" - ")}</p>
          </div>
        ) : (
          <div className="rounded border border-dashed border-(--border)/40 bg-slate-50 px-2 py-2 text-xs text-(--text)/55">
            {emptyLabel}
          </div>
        )}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setShowSignaturePrompt(target)}
            className="w-full rounded bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            {value ? "Replace Signature" : "Click to Sign"}
          </button>
        )}
      </div>
    );
  }

  const dailyCompletionPercent = useMemo(() => {
    if (!summary || summary.daily_reports.due === 0) return "0%";
    return `${Math.round((summary.daily_reports.submitted / summary.daily_reports.due) * 100)}%`;
  }, [summary]);

  const resolvedSummaryMetrics = useMemo(() => {
    if (!payload) {
      return {
        totalWorkOrdersOpened: "0",
        totalWorkOrdersClosed: "0",
        workOrdersRemainingOpen: "0",
        level1Count: "0",
        level2Count: "0",
        level3Count: "0",
        level4Count: "0",
        notableEvents: "0",
      };
    }
    const priorityCounts = getPriorityCounts(summary, payload);

    const openedFallback = summary?.work_orders.total ?? countRowsWithValues(payload.workOrdersOpened, [
      "workOrderNumber",
      "description",
      "area",
      "owner",
      "status",
    ]);
    const closedFallback = summary?.work_orders.completed ?? countRowsWithValues(payload.workOrdersClosed, [
      "workOrderNumber",
      "description",
      "area",
      "owner",
      "status",
    ]);
    const remainingOpenFallback =
      summary?.work_orders.pending !== undefined && summary?.work_orders.in_progress !== undefined
        ? summary.work_orders.pending + summary.work_orders.in_progress
        : countRowsWithValues(payload.agingOpenWorkOrders, [
            "workOrderNumber",
            "description",
            "area",
            "owner",
            "status",
          ]);
    const notableEventsFallback = summary?.incidents.total ?? countRowsWithValues(payload.incidents, [
      "incidentNumber",
      "incidentType",
      "location",
      "owner",
      "status",
    ]);

    return {
      totalWorkOrdersOpened: payload.summaryMetrics.totalWorkOrdersOpened || String(openedFallback),
      totalWorkOrdersClosed: payload.summaryMetrics.totalWorkOrdersClosed || String(closedFallback),
      workOrdersRemainingOpen: payload.summaryMetrics.workOrdersRemainingOpen || String(remainingOpenFallback),
      level1Count:
        payload.summaryMetrics.level1Count ||
        payload.deficiencyRegister.level1 ||
        String(priorityCounts.low),
      level2Count:
        payload.summaryMetrics.level2Count ||
        payload.deficiencyRegister.level2 ||
        String(priorityCounts.moderate),
      level3Count:
        payload.summaryMetrics.level3Count ||
        payload.deficiencyRegister.level3 ||
        String(priorityCounts.immediate),
      level4Count:
        payload.summaryMetrics.level4Count ||
        payload.deficiencyRegister.level4 ||
        String(priorityCounts.boardApproval),
      notableEvents: payload.summaryMetrics.notableEvents || String(notableEventsFallback),
    };
  }, [payload, summary]);

  const resolvedDeficiencyMetrics = useMemo(() => {
    if (!payload) {
      return {
        totalOpenStart: "0",
        newThisMonth: "0",
        closedThisMonth: "0",
        openEnd: "0",
        level1: "0",
        level2: "0",
        level3: "0",
        level4: "0",
      };
    }

    const priorityCounts = getPriorityCounts(summary, payload);
    const totalOpenStartFallback = countRowsWithValues(payload.agingOpenWorkOrders, [
      "workOrderNumber",
      "description",
      "area",
      "owner",
      "status",
    ]);
    const newThisMonthFallback = summary?.work_orders.total ?? countRowsWithValues(payload.workOrdersOpened, [
      "workOrderNumber",
      "description",
      "area",
      "owner",
      "status",
    ]);
    const closedThisMonthFallback = summary?.work_orders.completed ?? countRowsWithValues(payload.workOrdersClosed, [
      "workOrderNumber",
      "description",
      "area",
      "owner",
      "status",
    ]);
    const openEndFallback =
      summary?.work_orders.pending !== undefined && summary?.work_orders.in_progress !== undefined
        ? summary.work_orders.pending + summary.work_orders.in_progress
        : countRowsWithValues(payload.agingOpenWorkOrders, [
            "workOrderNumber",
            "description",
            "area",
            "owner",
            "status",
          ]);

    return {
      totalOpenStart: payload.deficiencyRegister.totalOpenStart || String(totalOpenStartFallback),
      newThisMonth: payload.deficiencyRegister.newThisMonth || String(newThisMonthFallback),
      closedThisMonth: payload.deficiencyRegister.closedThisMonth || String(closedThisMonthFallback),
      openEnd: payload.deficiencyRegister.openEnd || String(openEndFallback),
      level1: payload.deficiencyRegister.level1 || String(priorityCounts.low),
      level2: payload.deficiencyRegister.level2 || String(priorityCounts.moderate),
      level3: payload.deficiencyRegister.level3 || String(priorityCounts.immediate),
      level4: payload.deficiencyRegister.level4 || String(priorityCounts.boardApproval),
    };
  }, [payload, summary]);

  if (loading || !payload || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="bonan-monthly-editor min-h-screen bg-(--bg) overflow-x-hidden">
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

        <section className={classNames("rounded-2xl border p-3 md:p-4 space-y-3", SECTION_TONES.overview.shell)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2">
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
              <p className="text-lg font-semibold text-(--text)">{dailyCompletionPercent}</p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Completion</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-lg font-semibold text-(--text)">
                ${(summary?.material_costs.total ?? 0).toFixed(2)}
              </p>
              <p className="text-[10px] text-(--text)/55 uppercase tracking-wide">Materials</p>
            </div>
            <div className="rounded-lg border border-(--border)/20 bg-slate-50 p-2 flex items-center justify-center gap-3">
              <Link href="/dashboard/bonan/weekly" className="text-xs font-semibold text-blue-700 hover:underline">Weekly</Link>
              <Link href="/dashboard/bonan/daily" className="text-xs font-semibold text-blue-700 hover:underline">Daily</Link>
            </div>
          </div>
        </section>

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.chain.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.chain.header)}>
            <h2 className="text-sm md:text-base font-bold">Weekly to Monthly Hyperlinked Chain</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Quick navigation across the monthly reporting chain.</p>
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

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.chain.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.chain.header)}>
            <h2 className="text-sm md:text-base font-bold">Daily Reports Linked to This Month</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Scan daily coverage and jump directly into the source report.</p>
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

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.outlook.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.outlook.header)}>
            <h2 className="text-sm md:text-base font-bold">Monthly Recommendations & Upcoming</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Shared guidance and near-term items everyone should see quickly.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 md:p-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--text)/60">Recommendations</p>
              <textarea
                rows={5}
                value={payload.sharedOutlook.recommendations}
                onChange={(event) => updatePayload((current) => ({ ...current, sharedOutlook: { ...current.sharedOutlook, recommendations: event.target.value } }))}
                disabled={isReadOnly}
                placeholder="Shared recommendations for operations, safety, or follow-up."
                className="w-full rounded-xl border border-(--border)/35 bg-white/90 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--text)/60">Upcoming</p>
              <textarea
                rows={5}
                value={payload.sharedOutlook.upcoming}
                onChange={(event) => updatePayload((current) => ({ ...current, sharedOutlook: { ...current.sharedOutlook, upcoming: event.target.value } }))}
                disabled={isReadOnly}
                placeholder="Upcoming work, inspections, deadlines, or expected follow-up."
                className="w-full rounded-xl border border-(--border)/35 bg-white/90 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
          </div>
        </section>

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.fire.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.fire.header)}>
            <h2 className="text-sm md:text-base font-bold">Monthly - Fire Extinguisher Visual Inspection Log</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Life-safety extinguisher status and visual inspection trail.</p>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs border-b border-(--border)/15">
            <input value={payload.fireExtinguisherLog.monthYear} onChange={(event) => updatePayload((current) => ({ ...current, fireExtinguisherLog: { ...current.fireExtinguisherLog, monthYear: event.target.value } }))} disabled={isReadOnly} placeholder="Month / Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.fireExtinguisherLog.inspector} onChange={(event) => updatePayload((current) => ({ ...current, fireExtinguisherLog: { ...current.fireExtinguisherLog, inspector: event.target.value } }))} disabled={isReadOnly} placeholder="Inspector" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.fireExtinguisherLog.supervisorReview} onChange={(event) => updatePayload((current) => ({ ...current, fireExtinguisherLog: { ...current.fireExtinguisherLog, supervisorReview: event.target.value } }))} disabled={isReadOnly} placeholder="Supervisor Review" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            {renderSignatureControl("fire_extinguisher", payload.fireExtinguisherLog.signature)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Extinguisher ID / Location</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Gauge</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Pin Seal</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Accessible</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Condition (P/F)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Init.</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Notes / WO#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.fireExtinguisherLog.rows.map((row, rowIndex) => (
                  <tr key={`fire-${rowIndex}`}>
                    <td className="px-2.5 py-1.5"><input value={row.extinguisherIdLocation} onChange={(event) => updateFireRow(rowIndex, "extinguisherIdLocation", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.gauge} onChange={(event) => updateFireRow(rowIndex, "gauge", event.target.value as MonthlyFireExtinguisherRow["gauge"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select gauge</option>
                        {FIRE_GAUGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.pinSeal} onChange={(event) => updateFireRow(rowIndex, "pinSeal", event.target.value as MonthlyFireExtinguisherRow["pinSeal"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select status</option>
                        {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.accessible} onChange={(event) => updateFireRow(rowIndex, "accessible", event.target.value as MonthlyFireExtinguisherRow["accessible"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select access</option>
                        {FIRE_YES_NO_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.condition} onChange={(event) => updateFireRow(rowIndex, "condition", event.target.value as MonthlyFireExtinguisherRow["condition"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select condition</option>
                        {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5"><input value={row.initials} onChange={(event) => updateFireRow(rowIndex, "initials", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5"><input value={row.notesWorkOrder} onChange={(event) => updateFireRow(rowIndex, "notesWorkOrder", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.emergency.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.emergency.header)}>
            <h2 className="text-sm md:text-base font-bold">Monthly - Emergency Lighting & Exit Sign Test Log</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Emergency egress readiness and corrective action visibility.</p>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs border-b border-(--border)/15">
            <input value={payload.emergencyLightingLog.monthYear} onChange={(event) => updatePayload((current) => ({ ...current, emergencyLightingLog: { ...current.emergencyLightingLog, monthYear: event.target.value } }))} disabled={isReadOnly} placeholder="Month / Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.emergencyLightingLog.inspector} onChange={(event) => updatePayload((current) => ({ ...current, emergencyLightingLog: { ...current.emergencyLightingLog, inspector: event.target.value } }))} disabled={isReadOnly} placeholder="Inspector" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.emergencyLightingLog.supervisorReview} onChange={(event) => updatePayload((current) => ({ ...current, emergencyLightingLog: { ...current.emergencyLightingLog, supervisorReview: event.target.value } }))} disabled={isReadOnly} placeholder="Supervisor Review" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            {renderSignatureControl("emergency_lighting", payload.emergencyLightingLog.signature)}
          </div>
          <div className="block md:hidden divide-y divide-(--border)/12">
            {payload.emergencyLightingLog.rows.map((row, rowIndex) => (
              <div key={`light-mobile-${rowIndex}`} className="p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text)/55">
                    Test {rowIndex + 1}
                  </p>
                  <input
                    value={row.initials}
                    onChange={(event) => updateEmergencyRow(rowIndex, "initials", event.target.value)}
                    disabled={isReadOnly}
                    placeholder="Init."
                    className="w-16 shrink-0 rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <label className="min-w-0 flex-[1_1_8.75rem] space-y-1">
                    <span className="font-medium text-(--text)/55">Date</span>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(event) => updateEmergencyRow(rowIndex, "date", event.target.value)}
                      disabled={isReadOnly}
                      className="block w-full min-w-0 rounded border border-(--border)/35 bg-white px-2 py-2 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="min-w-0 flex-[2_1_11rem] space-y-1">
                    <span className="font-medium text-(--text)/55">Area / Device</span>
                    <input
                      value={row.areaDevice}
                      onChange={(event) => updateEmergencyRow(rowIndex, "areaDevice", event.target.value)}
                      disabled={isReadOnly}
                      className="block w-full min-w-0 rounded border border-(--border)/35 bg-white px-2 py-2 disabled:bg-slate-50"
                    />
                  </label>
                  <label className="min-w-0 flex-[1_1_9rem] space-y-1">
                    <span className="font-medium text-(--text)/55">Condition</span>
                    <select
                      value={row.condition}
                      onChange={(event) => updateEmergencyRow(rowIndex, "condition", event.target.value as MonthlyEmergencyLightingRow["condition"])}
                      disabled={isReadOnly}
                      className="block w-full min-w-0 rounded border border-(--border)/35 bg-white px-2 py-2 disabled:bg-slate-50"
                    >
                      <option value="">Select</option>
                      {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 flex-[2_1_100%] space-y-1">
                    <span className="font-medium text-(--text)/55">Corrective Action / WO#</span>
                    <input
                      value={row.correctiveActionWorkOrder}
                      onChange={(event) => updateEmergencyRow(rowIndex, "correctiveActionWorkOrder", event.target.value)}
                      disabled={isReadOnly}
                      className="block w-full min-w-0 rounded border border-(--border)/35 bg-white px-2 py-2 disabled:bg-slate-50"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] table-fixed text-xs">
              <colgroup>
                <col className="w-[128px]" />
                <col className="w-[220px]" />
                <col className="w-[132px]" />
                <col className="w-[300px]" />
                <col className="w-[80px]" />
              </colgroup>
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">Date</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Area / Device</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Condition (P/F)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Corrective Action / WO#</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Init.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.emergencyLightingLog.rows.map((row, rowIndex) => (
                  <tr key={`light-${rowIndex}`}>
                    <td className="px-1.5 py-1.5"><input type="date" value={row.date} onChange={(event) => updateEmergencyRow(rowIndex, "date", event.target.value)} disabled={isReadOnly} className="block w-full min-w-0 max-w-full rounded border border-(--border)/35 bg-white px-1.5 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-1.5 py-1.5"><input value={row.areaDevice} onChange={(event) => updateEmergencyRow(rowIndex, "areaDevice", event.target.value)} disabled={isReadOnly} className="block w-full min-w-0 max-w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.condition} onChange={(event) => updateEmergencyRow(rowIndex, "condition", event.target.value as MonthlyEmergencyLightingRow["condition"])} disabled={isReadOnly} className="block w-full min-w-0 max-w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select condition</option>
                        {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1.5 py-1.5"><input value={row.correctiveActionWorkOrder} onChange={(event) => updateEmergencyRow(rowIndex, "correctiveActionWorkOrder", event.target.value)} disabled={isReadOnly} className="block w-full min-w-0 max-w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                    <td className="px-1.5 py-1.5"><input value={row.initials} onChange={(event) => updateEmergencyRow(rowIndex, "initials", event.target.value)} disabled={isReadOnly} className="block w-full min-w-0 max-w-full rounded border border-(--border)/35 bg-white px-1.5 py-1 disabled:bg-slate-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.deficiency.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.deficiency.header)}>
            <h2 className="text-sm md:text-base font-bold">Monthly Deficiency Register & Open Work Orders</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Priority rollup tied to linked work orders and board-approval tracking.</p>
          </div>
          <div className="p-3 md:p-4 space-y-2 text-xs border-b border-(--border)/15">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={payload.deficiencyRegister.monthYear} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, monthYear: event.target.value } }))} disabled={isReadOnly} placeholder="Month / Year" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.preparedBy} disabled placeholder="Prepared By" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={payload.deficiencyRegister.supervisorReview} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, supervisorReview: event.target.value } }))} disabled={isReadOnly} placeholder="Supervisor Review" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
              {renderSignatureControl("deficiency", payload.deficiencyRegister.signature)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-8 gap-2">
              <input value={resolvedDeficiencyMetrics.totalOpenStart} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, totalOpenStart: event.target.value } }))} disabled={isReadOnly} placeholder="Total Open (Start)" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={resolvedDeficiencyMetrics.newThisMonth} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, newThisMonth: event.target.value } }))} disabled={isReadOnly} placeholder="New This Month" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={resolvedDeficiencyMetrics.closedThisMonth} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, closedThisMonth: event.target.value } }))} disabled={isReadOnly} placeholder="Closed This Month" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={resolvedDeficiencyMetrics.openEnd} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, openEnd: event.target.value } }))} disabled={isReadOnly} placeholder="Open (End)" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={resolvedDeficiencyMetrics.level1} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level1: event.target.value } }))} disabled={isReadOnly} placeholder="Priority - Low" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={resolvedDeficiencyMetrics.level2} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level2: event.target.value } }))} disabled={isReadOnly} placeholder="Priority - Moderate" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={resolvedDeficiencyMetrics.level3} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level3: event.target.value } }))} disabled={isReadOnly} placeholder="Priority - Immediate" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
              <input value={resolvedDeficiencyMetrics.level4} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, level4: event.target.value } }))} disabled={isReadOnly} placeholder="Board Approval Level" className="rounded border border-(--border)/35 bg-white/90 px-2 py-1.5 disabled:bg-slate-50" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="bg-slate-100/70 text-(--text)/65">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">WO#</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Priority</th>
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
                    <td className="px-2.5 py-1.5">
                      <select value={row.level} onChange={(event) => updateDeficiencyRow(rowIndex, "level", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select priority</option>
                        {DEFICIENCY_PRIORITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
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
            <textarea rows={3} value={payload.deficiencyRegister.managementNotes} onChange={(event) => updatePayload((current) => ({ ...current, deficiencyRegister: { ...current.deficiencyRegister, managementNotes: event.target.value } }))} disabled={isReadOnly} placeholder="Management Recommendation Notes" className="w-full rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <div className="grid grid-cols-1 gap-2 md:max-w-md">
              {renderSignatureControl("board_approval", payload.deficiencyRegister.ownerExecutiveReview, "No board approval signature recorded")}
              <input value={payload.deficiencyRegister.ownerExecutiveDate} readOnly disabled placeholder="Board Approval Date & Time" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            </div>
          </div>
        </section>

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.elevator.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.elevator.header)}>
            <h2 className="text-sm md:text-base font-bold">Elevator Monthly Compliance & Functional Log</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Permit and functionality status for the monthly elevator checks.</p>
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
                  <th className="px-2.5 py-2 text-left font-semibold">Permit (Yes/No)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Ride/Doors (P/F)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Alarm (P/F)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Phone (P/F)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Cab (P/F)</th>
                  <th className="px-2.5 py-2 text-left font-semibold">Notes/WO#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)/12">
                {payload.elevatorComplianceLog.rows.map((row, rowIndex) => (
                  <tr key={`elev-${rowIndex}`}>
                    <td className="px-2.5 py-1.5">{row.elevator}</td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.permit} onChange={(event) => updateElevatorRow(rowIndex, "permit", event.target.value as MonthlyElevatorComplianceRow["permit"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select permit</option>
                        {FIRE_YES_NO_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.rideDoors} onChange={(event) => updateElevatorRow(rowIndex, "rideDoors", event.target.value as MonthlyElevatorComplianceRow["rideDoors"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select status</option>
                        {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.alarm} onChange={(event) => updateElevatorRow(rowIndex, "alarm", event.target.value as MonthlyElevatorComplianceRow["alarm"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select status</option>
                        {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.phone} onChange={(event) => updateElevatorRow(rowIndex, "phone", event.target.value as MonthlyElevatorComplianceRow["phone"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select status</option>
                        {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <select value={row.cab} onChange={(event) => updateElevatorRow(rowIndex, "cab", event.target.value as MonthlyElevatorComplianceRow["cab"])} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50">
                        <option value="">Select status</option>
                        {FIRE_PASS_FAIL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5"><input value={row.notesWorkOrder} onChange={(event) => updateElevatorRow(rowIndex, "notesWorkOrder", event.target.value)} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs border-t border-(--border)/15">
            <input value={payload.elevatorComplianceLog.northCarAExpiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, northCarAExpiration: event.target.value } }))} disabled={isReadOnly} placeholder="North Car A Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.northCarBExpiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, northCarBExpiration: event.target.value } }))} disabled={isReadOnly} placeholder="North Car B Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.southCarAExpiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, southCarAExpiration: event.target.value } }))} disabled={isReadOnly} placeholder="South Car A Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <input value={payload.elevatorComplianceLog.southCarBExpiration} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, southCarBExpiration: event.target.value } }))} disabled={isReadOnly} placeholder="South Car B Expiration" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            <textarea value={payload.elevatorComplianceLog.notesCorrectiveActions} onChange={(event) => updatePayload((current) => ({ ...current, elevatorComplianceLog: { ...current.elevatorComplianceLog, notesCorrectiveActions: event.target.value } }))} disabled={isReadOnly} placeholder="Notes / Corrective Actions" className="md:col-span-2 rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" rows={3} />
          </div>
        </section>

        <section className={classNames("rounded-2xl border overflow-hidden", SECTION_TONES.closeout.shell)}>
          <div className={classNames("px-3 md:px-4 py-2.5 border-b", SECTION_TONES.closeout.header)}>
            <h2 className="text-sm md:text-base font-bold">Monthly Closeout & Filing Certification</h2>
            <p className="mt-0.5 text-[11px] font-medium text-white/75">Month-end metrics, signoff, and operational closeout.</p>
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
                  ["level1Count", "Priority - Low"],
                  ["level2Count", "Priority - Moderate"],
                  ["level3Count", "Priority - Immediate"],
                  ["level4Count", "Board Approval Level"],
                  ["notableEvents", "Notable Events / Incidents"],
                ] as const).map(([field, label]) => (
                  <tr key={field}>
                    <td className="px-2.5 py-1.5">{label}</td>
                    <td className="px-2.5 py-1.5">
                      <input value={resolvedSummaryMetrics[field]} onChange={(event) => updatePayload((current) => ({ ...current, summaryMetrics: { ...current.summaryMetrics, [field]: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1 disabled:bg-slate-50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            {renderSignatureControl("certified_by", payload.closeoutCertification.certifiedBySignature)}
            <input value={payload.closeoutCertification.certifiedDate} onChange={(event) => updatePayload((current) => ({ ...current, closeoutCertification: { ...current.closeoutCertification, certifiedDate: event.target.value } }))} disabled={isReadOnly} placeholder="Date" className="rounded border border-(--border)/35 px-2 py-1.5 disabled:bg-slate-50" />
            {renderSignatureControl("reviewed_accepted", payload.closeoutCertification.reviewedAcceptedSignature)}
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
      {showSignaturePrompt && (
        <ClickSignatureModal
          signerName={currentUserName}
          signerLabel="Monthly Summary Signer"
          submitLabel="Submit Signature"
          onSave={applyEmployeeSignature}
          onCancel={() => setShowSignaturePrompt(null)}
        />
      )}
    </div>
  );
}
