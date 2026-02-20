"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BonanReportStatus } from "@/lib/bonan-types";
import { formatUsCentralDateTime } from "@/lib/us-central-time";

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
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [reports, setReports] = useState<BonanReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
        if (sessionData.user.role === "client") {
          router.push("/dashboard");
          return;
        }
        setUserRole(sessionData.user.role);

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

  async function handleCreateDailyReport() {
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/bonan/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: "daily" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create daily report.");
        return;
      }

      router.push(`/dashboard/bonan/daily/${data.report.id}`);
    } catch (createError) {
      console.error("Failed to create Bonan daily report:", createError);
      setError("Failed to create daily report.");
    } finally {
      setCreating(false);
    }
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
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-(--text)/55">
              Bonan Towers
            </p>
            <h1 className="text-2xl font-bold text-(--text)">Daily Walk-Through Reports</h1>
            <p className="text-sm text-(--text)/60">
              Drafts autosave every 30 seconds. Weekly and monthly modules are staged next.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/bonan"
              className="rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Back to Bonan
            </Link>
            <button
              type="button"
              onClick={handleCreateDailyReport}
              disabled={creating}
              className="tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {creating ? "Creating..." : "New Daily Walk-Through"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="tl-card p-4 border border-emerald-200 bg-emerald-50/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active Module</p>
            <p className="text-base font-semibold text-emerald-900 mt-1">Daily Walk-Through</p>
            <p className="text-sm text-emerald-800/80 mt-1">Coverage matrix, life safety, incidents, fridge, fire alarm logs.</p>
          </div>
          <div className="tl-card p-4 border border-slate-200 bg-slate-50/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Planned Next</p>
            <p className="text-base font-semibold text-slate-900 mt-1">Weekly + Monthly Aggregation</p>
            <p className="text-sm text-slate-700/80 mt-1">Foundation is in place for linked rollups and closeout summaries.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="tl-card p-8 text-center">
            <p className="text-(--text)/70">No Bonan daily reports yet.</p>
            <p className="mt-2 text-sm text-(--text)/50">Create your first daily walk-through to start the log trail.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const inspector = report.payload?.metadata?.inspector || "Unassigned inspector";
              const shift = report.payload?.metadata?.shift || "No shift set";
              return (
                <div
                  key={report.id}
                  className="tl-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Link href={`/dashboard/bonan/daily/${report.id}`} className="group">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-(--text) group-hover:underline">Daily Report {report.report_date}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[report.status]}`}>
                            {report.status === "submitted" ? "Submitted" : "Draft"}
                          </span>
                          {report.work_order_number && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              WO #{report.work_order_number}
                            </span>
                          )}
                        </div>
                      </Link>
                      <p className="text-sm text-(--text)/70">Inspector: {inspector}</p>
                      <p className="text-xs text-(--text)/55">Shift: {shift}</p>
                    </div>
                    <div className="text-right text-xs text-(--text)/50 space-y-2">
                      <p>Updated</p>
                      <p className="mt-1">{formatUsCentralDateTime(report.updated_at)} CT</p>
                      {userRole === "admin" && (
                        <button
                          type="button"
                          onClick={() => openDeleteReportWarning(report)}
                          disabled={deletingId === report.id}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-60"
                        >
                          {deletingId === report.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingDeleteReport && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            if (deletingId) return;
            setPendingDeleteReport(null);
            setDeleteConfirmInput("");
            setDeleteConfirmError("");
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-red-700">Delete Daily Report Warning</h3>
            <p className="mt-2 text-sm text-slate-700">
              This will permanently delete daily report <strong>{pendingDeleteReport.report_date}</strong> and its
              primary linked work order.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Type <strong>{pendingDeleteReport.report_date}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => {
                setDeleteConfirmInput(event.target.value);
                if (deleteConfirmError) setDeleteConfirmError("");
              }}
              placeholder={`Type ${pendingDeleteReport.report_date}`}
              className="mt-3 w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200"
              disabled={Boolean(deletingId)}
            />
            {deleteConfirmError && <p className="mt-2 text-xs text-red-600">{deleteConfirmError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingId) return;
                  setPendingDeleteReport(null);
                  setDeleteConfirmInput("");
                  setDeleteConfirmError("");
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteReport()}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "Deleting..." : "Delete Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
