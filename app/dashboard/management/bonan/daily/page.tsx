"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BonanReportStatus } from "@/lib/bonan-types";
import { formatUsCentralDateTime, getUsCentralDate } from "@/lib/us-central-time";
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
      inspector?: string;
      shift?: string;
    };
  };
}

const STATUS_STYLES: Record<BonanReportStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  submitted: "bg-green-100 text-green-700",
};

export default function BonanDailyReportsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"admin" | "employee" | "client" | null>(null);
  const [reports, setReports] = useState<BonanReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [newReportDate, setNewReportDate] = useState("");
  const [createPromptError, setCreatePromptError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteReport, setPendingDeleteReport] = useState<BonanReportSummary | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteConfirmError, setDeleteConfirmError] = useState("");
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
        setUserRole(sessionData.user.role as "admin" | "employee" | "client");

        const reportsRes = await fetch("/api/bonan/reports?report_type=daily");
        const reportsData = await reportsRes.json();
        if (!reportsRes.ok) {
          setError(reportsData.error || "Failed to load Bonan daily reports.");
          return;
        }

        setReports((reportsData.reports || []) as BonanReportSummary[]);
      } catch (fetchError) {
        console.error("Failed to initialize Bonan daily reports page:", fetchError);
        setError("Failed to load Bonan daily reports.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  async function createDailyReport(reportDate?: string) {
    setCreating(true);
    setError("");
    setCreatePromptError("");

    try {
      const res = await fetch("/api/bonan/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: "daily",
          ...(reportDate ? { report_date: reportDate } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existingReport?.id) {
          setShowCreatePrompt(true);
          setCreatePromptError("One has been made for this day already select another day.");
          setNewReportDate(reportDate || data.existingReport.report_date || getUsCentralDate(new Date()));
          return;
        }
        const message = data.error || "Failed to create daily report.";
        if (showCreatePrompt) {
          setCreatePromptError(message);
        } else {
          setError(message);
        }
        return;
      }

      setShowCreatePrompt(false);
      router.push(`/dashboard/bonan/daily/${data.report.id}`);
    } catch (createError) {
      console.error("Failed to create Bonan daily report:", createError);
      if (showCreatePrompt) {
        setCreatePromptError("Failed to create daily report.");
      } else {
        setError("Failed to create daily report.");
      }
    } finally {
      setCreating(false);
    }
  }

  function handleCreateDailyReportClick() {
    if (creating) return;

    const todayDate = getUsCentralDate(new Date());
    const todayReport = reports.find((report) => report.report_date === todayDate);
    if (!todayReport) {
      void createDailyReport(todayDate);
      return;
    }

    setNewReportDate(todayDate);
    setCreatePromptError("One has been made for this day already select another day.");
    setShowCreatePrompt(true);
  }

  function handleCreateOrOpenSelectedDate() {
    if (!newReportDate) {
      setCreatePromptError("Select a date to continue.");
      return;
    }

    const selectedExisting = reports.find((report) => report.report_date === newReportDate);
    if (selectedExisting) {
      setCreatePromptError("One has been made for this day already select another day.");
      return;
    }

    void createDailyReport(newReportDate);
  }

  function openDeleteReportWarning(report: BonanReportSummary) {
    if (userRole !== "admin" || deletingId) return;
    setPendingDeleteReport(report);
    setDeleteConfirmInput("");
    setDeleteConfirmError("");
  }

  async function handleDeleteReport() {
    if (userRole !== "admin" || !pendingDeleteReport || deletingId) return;
    if (deleteConfirmInput.trim() !== pendingDeleteReport.report_date) {
      setDeleteConfirmError(`Type ${pendingDeleteReport.report_date} to confirm deletion.`);
      return;
    }

    setDeletingId(pendingDeleteReport.id);
    setError("");
    setDeleteConfirmError("");
    try {
      const res = await fetch(`/api/bonan/reports/${pendingDeleteReport.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteConfirmError(data.error || "Failed to delete daily report.");
        return;
      }

      setReports((previous) => previous.filter((report) => report.id !== pendingDeleteReport.id));
      setPendingDeleteReport(null);
      setDeleteConfirmInput("");
    } catch (deleteError) {
      console.error("Failed to delete daily report:", deleteError);
      setDeleteConfirmError("Failed to delete daily report.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-(--bg) overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-3 md:px-4 lg:px-6 py-4 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/bonan"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--border)/30 text-(--text)/70 hover:bg-(--bg) transition"
            aria-label="Back to Bonan"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-(--text)">Daily Walk-Throughs & Reviews</h1>
            <p className="text-xs text-(--text)/50 mt-0.5">Bonan Towers Operations</p>
          </div>
          {userRole !== "client" && (
            <button
              type="button"
              onClick={handleCreateDailyReportClick}
              disabled={creating || loading}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {creating ? "Creating..." : loading ? "Loading..." : "+ New Report"}
            </button>
          )}
        </div>

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
            <p className="text-sm text-(--text)/60">No daily reports yet.</p>
            <p className="mt-1 text-xs text-(--text)/40">
              {userRole === "client"
                ? "No daily submissions are available for review yet."
                : "Create your first daily walk-through to get started."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden divide-y divide-(--border)/10">
            {reports.map((report) => {
              const inspector = report.payload?.metadata?.inspector || "Unassigned";
              const shift = report.payload?.metadata?.shift || "";
              return (
                <Link
                  key={report.id}
                  href={`/dashboard/bonan/daily/${report.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-(--bg)/50 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-(--text)">{report.report_date}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[report.status]}`}>
                        {report.status === "submitted" ? "Submitted" : "Draft"}
                      </span>
                      {report.work_order_number && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                          WO #{report.work_order_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-(--text)/50 mt-0.5 truncate">
                      {inspector}{shift ? ` · ${shift}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="hidden sm:block text-[10px] text-(--text)/40">{formatUsCentralDateTime(report.updated_at)}</span>
                    {userRole === "admin" && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openDeleteReportWarning(report);
                        }}
                        disabled={deletingId === report.id}
                        className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-60"
                      >
                        {deletingId === report.id ? "..." : "Delete"}
                      </button>
                    )}
                    <svg className="h-3.5 w-3.5 text-(--text)/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showCreatePrompt && (
        <ModalLayer
          align="sheet-sm"
          className="bg-black/50 backdrop-blur-sm"
          onBackdropClick={() => {
            if (creating) return;
            setShowCreatePrompt(false);
            setCreatePromptError("");
          }}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">Create Daily Walk-Through</h3>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-slate-500">Select date</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newReportDate}
                  onChange={(event) => {
                    setNewReportDate(event.target.value);
                    if (createPromptError) setCreatePromptError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={creating}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (creating) return;
                    setNewReportDate("");
                    if (createPromptError) setCreatePromptError("");
                  }}
                  className="shrink-0 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  disabled={creating}
                >
                  Clear Day
                </button>
              </div>
            </div>

            {createPromptError && <p className="mt-2 text-xs text-red-600">{createPromptError}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (creating) return;
                  setShowCreatePrompt(false);
                  setCreatePromptError("");
                }}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrOpenSelectedDate}
                className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={creating}
              >
                {creating ? "Working..." : "Create for Day"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}

      {pendingDeleteReport && (
        <ModalLayer
          align="sheet-sm"
          className="bg-black/50 backdrop-blur-sm"
          onBackdropClick={() => {
            if (deletingId) return;
            setPendingDeleteReport(null);
            setDeleteConfirmInput("");
            setDeleteConfirmError("");
          }}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-red-600">Delete Report</h3>
            <p className="mt-2 text-sm text-slate-600">
              Permanently delete <strong>{pendingDeleteReport.report_date}</strong> and its linked work order.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Type <strong>{pendingDeleteReport.report_date}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => {
                setDeleteConfirmInput(event.target.value);
                if (deleteConfirmError) setDeleteConfirmError("");
              }}
              placeholder={pendingDeleteReport.report_date}
              className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-300"
              disabled={Boolean(deletingId)}
            />
            {deleteConfirmError && <p className="mt-2 text-xs text-red-600">{deleteConfirmError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingId) return;
                  setPendingDeleteReport(null);
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
