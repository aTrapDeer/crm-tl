"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BonanReportStatus } from "@/lib/bonan-types";
import {
  formatUsCentralDateTime,
  getWeekEndSaturday,
  getWeekStartSunday,
} from "@/lib/us-central-time";
import { ModalLayer } from "@/app/components/ModalLayer";

interface BonanReportSummary {
  id: string;
  report_type: "daily" | "weekly" | "monthly";
  status: BonanReportStatus;
  report_date: string;
  work_order_number?: string;
  updated_at: string;
  payload: {
    metadata?: {
      preparedBy?: string;
      propertyManagerReview?: string;
    };
  };
}

interface BonanPeriodReportListProps {
  reportType: "weekly" | "monthly";
  title: string;
  subtitle: string;
  createLabel: string;
  detailPathBase?: string;
  showCreate?: boolean;
  allowedRoles?: Array<"admin" | "employee" | "client">;
  disallowedRedirectPath?: string;
  contextLinks?: Array<{ href: string; label: string }>;
}

const STATUS_STYLES: Record<BonanReportStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  submitted: "bg-green-100 text-green-700",
};

export default function BonanPeriodReportList({
  reportType,
  title,
  subtitle,
  createLabel,
  detailPathBase,
  showCreate = true,
  allowedRoles = ["admin", "employee", "client"],
  disallowedRedirectPath = "/dashboard/bonan",
  contextLinks = [],
}: BonanPeriodReportListProps) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"admin" | "employee" | "client" | null>(null);
  const [reports, setReports] = useState<BonanReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPeriodDate, setNewPeriodDate] = useState("");
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BonanReportSummary | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteConfirmError, setDeleteConfirmError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          router.push("/login");
          return;
        }
        const nextRole = sessionData.user.role as "admin" | "employee" | "client";
        if (!allowedRoles.includes(nextRole)) {
          router.push(disallowedRedirectPath);
          return;
        }
        setUserRole(nextRole);

        const reportsRes = await fetch(`/api/bonan/reports?report_type=${reportType}`);
        const reportsData = await reportsRes.json();
        if (!reportsRes.ok) {
          setError(reportsData.error || `Failed to load ${reportType} reports.`);
          return;
        }

        setReports((reportsData.reports || []) as BonanReportSummary[]);
      } catch (fetchError) {
        console.error(`Failed to initialize ${reportType} reports page:`, fetchError);
        setError(`Failed to load ${reportType} reports.`);
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [allowedRoles, disallowedRedirectPath, reportType, router]);

  const periodPlaceholder = useMemo(
    () => (reportType === "monthly" ? "Select month" : "Select week date"),
    [reportType]
  );
  const canCreate = showCreate && userRole !== "client";
  const reportDetailPathBase = detailPathBase || `/dashboard/bonan/${reportType}`;

  function getDisplayPeriod(reportDate: string): string {
    const formatDate = (dateStr: string, options: Intl.DateTimeFormatOptions) => {
      const [year, month, day] = dateStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, day ? parseInt(day) : 1);
      return date.toLocaleDateString("en-US", options);
    };

    if (reportType === "weekly") {
      const start = getWeekStartSunday(reportDate);
      const end = getWeekEndSaturday(reportDate);
      return `${formatDate(start, { month: "short", day: "numeric", year: "numeric" })} - ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    
    return formatDate(reportDate, { month: "long", year: "numeric" });
  }

  function normalizeInputPeriodDate() {
    if (!newPeriodDate) return "";
    if (reportType === "monthly") {
      return `${newPeriodDate}-01`;
    }
    return newPeriodDate;
  }

  async function handleCreateReport() {
    const normalizedDate = normalizeInputPeriodDate();
    if (!normalizedDate) {
      setError(`Select a ${reportType === "monthly" ? "month" : "date"} first.`);
      return;
    }

    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/bonan/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: reportType,
          report_date: normalizedDate,
        }),
      });
      const data = await res.json();

        if (!res.ok) {
          if (res.status === 409 && data.existingReport?.id) {
          router.push(`${reportDetailPathBase}/${data.existingReport.id}`);
          return;
        }
        setError(data.error || `Failed to create ${reportType} report.`);
        return;
      }

      setShowCreateModal(false);
      router.push(`${reportDetailPathBase}/${data.report.id}`);
    } catch (createError) {
      console.error(`Failed to create ${reportType} report:`, createError);
      setError(`Failed to create ${reportType} report.`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteReport() {
    if (!pendingDelete || deletingId) return;
    if (deleteConfirmInput.trim() !== pendingDelete.report_date) {
      setDeleteConfirmError(`Type ${pendingDelete.report_date} to confirm deletion.`);
      return;
    }

    setDeletingId(pendingDelete.id);
    setDeleteConfirmError("");
    try {
      const res = await fetch(`/api/bonan/reports/${pendingDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteConfirmError(data.error || `Failed to delete ${reportType} report.`);
        return;
      }

      setReports((previous) => previous.filter((row) => row.id !== pendingDelete.id));
      setPendingDelete(null);
      setDeleteConfirmInput("");
    } catch (deleteError) {
      console.error(`Failed to delete ${reportType} report:`, deleteError);
      setDeleteConfirmError(`Failed to delete ${reportType} report.`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-(--bg) overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-3 md:px-4 lg:px-6 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/bonan"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--border)/30 text-(--text)/70 hover:bg-(--bg) transition"
            aria-label="Back to Bonan"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-(--text)">{title}</h1>
            <p className="text-xs text-(--text)/50 mt-0.5">{subtitle}</p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={creating || loading}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {createLabel}
            </button>
          )}
        </div>
        {contextLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {contextLinks.map((link) => {
              // Determine styling based on the link label to give them distinct visual hierarchy
              let linkStyle = "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300";
              let icon = null;

              if (link.label.includes("Monthly")) {
                linkStyle = "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300";
                icon = (
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                );
              } else if (link.label.includes("Weekly")) {
                linkStyle = "bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 hover:border-teal-300";
                icon = (
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                );
              } else if (link.label.includes("Daily")) {
                linkStyle = "bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300";
                icon = (
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                );
              }

              return (
                <Link
                  key={`${link.href}:${link.label}`}
                  href={link.href}
                  className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${linkStyle}`}
                >
                  {icon}
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-(--border)/20 bg-white/80 p-8 text-center">
            <p className="text-sm text-(--text)/60">No {reportType} reports yet.</p>
            <p className="mt-1 text-xs text-(--text)/40">Create your first {reportType} report to get started.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden divide-y divide-(--border)/10">
            {reports.map((report) => {
              const preparedBy = report.payload?.metadata?.preparedBy || "Unassigned";
              return (
                <Link
                  key={report.id}
                  href={`${reportDetailPathBase}/${report.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-(--bg)/50 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-(--text)">{getDisplayPeriod(report.report_date)}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[report.status]}`}>
                        {report.status === "submitted" ? "Submitted" : "Draft"}
                      </span>
                      {report.work_order_number && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                          WO #{report.work_order_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-(--text)/50 mt-0.5 truncate">{preparedBy}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="hidden sm:block text-[10px] text-(--text)/40">{formatUsCentralDateTime(report.updated_at)}</span>
                    {userRole === "admin" && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setPendingDelete(report);
                          setDeleteConfirmInput("");
                          setDeleteConfirmError("");
                        }}
                        disabled={deletingId === report.id}
                        className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-60"
                      >
                        {deletingId === report.id ? "..." : "Delete"}
                      </button>
                    )}
                    <svg className="h-3.5 w-3.5 text-(--text)/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && canCreate && (
        <ModalLayer
          align="sheet-sm"
          className="bg-black/50 backdrop-blur-sm"
          onBackdropClick={() => {
            if (!creating) setShowCreateModal(false);
          }}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">Create {reportType} report</h3>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-500">{periodPlaceholder}</span>
              {reportType === "monthly" ? (
                <input
                  type="month"
                  value={newPeriodDate}
                  onChange={(event) => setNewPeriodDate(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              ) : (
                <input
                  type="date"
                  value={newPeriodDate}
                  onChange={(event) => setNewPeriodDate(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              )}
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => !creating && setShowCreateModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateReport()}
                className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}

      {pendingDelete && (
        <ModalLayer
          align="sheet-sm"
          className="bg-black/50 backdrop-blur-sm"
          onBackdropClick={() => {
            if (!deletingId) {
              setPendingDelete(null);
              setDeleteConfirmInput("");
              setDeleteConfirmError("");
            }
          }}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-red-600">Delete Report</h3>
            <p className="mt-2 text-sm text-slate-600">
              Type <strong>{pendingDelete.report_date}</strong> to confirm deletion.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => {
                setDeleteConfirmInput(event.target.value);
                if (deleteConfirmError) setDeleteConfirmError("");
              }}
              placeholder={pendingDelete.report_date}
              className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-300"
              disabled={Boolean(deletingId)}
            />
            {deleteConfirmError && <p className="mt-2 text-xs text-red-600">{deleteConfirmError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingId) return;
                  setPendingDelete(null);
                  setDeleteConfirmInput("");
                  setDeleteConfirmError("");
                }}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteReport()}
                className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}
    </div>
  );
}
