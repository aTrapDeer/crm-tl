"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface IncidentReport {
  id: string;
  report_number: string;
  report_date: string;
  section_name: string;
  location: string | null;
  status: "open" | "in_progress" | "closed";
  publication_status: "draft" | "published";
  description: string;
  updated_at: string;
}

const STATUS_STYLES: Record<IncidentReport["status"], string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700",
};

function formatIncidentStatusLabel(status: IncidentReport["status"]) {
  if (status === "open") return "Approval Needed";
  return status.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function IncidentReportsPage() {
  const router = useRouter();
  const createHref = "/dashboard/management/incident-reports/new?returnTo=/dashboard/incident-reports";
  const [loading, setLoading] = useState(true);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
  const [search, setSearch] = useState("");
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

        const reportsRes = await fetch("/api/incident-reports");
        const reportsData = await reportsRes.json().catch(() => ({}));
        if (!reportsRes.ok) {
          setError(reportsData.error || "Failed to load incident reports.");
          return;
        }

        setIncidentReports((reportsData.incidentReports || []) as IncidentReport[]);
      } catch (fetchError) {
        console.error("Failed to load incident reports:", fetchError);
        setError("Failed to load incident reports.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [router]);

  const filteredIncidentReports = useMemo(() => {
    if (!search.trim()) return incidentReports;
    const term = search.trim().toLowerCase();
    return incidentReports.filter((incidentReport) => {
      return (
        incidentReport.report_number.toLowerCase().includes(term) ||
        incidentReport.section_name.toLowerCase().includes(term) ||
        (incidentReport.location || "").toLowerCase().includes(term) ||
        incidentReport.description.toLowerCase().includes(term)
      );
    });
  }, [search, incidentReports]);

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-(--text)">Incident Reports</h1>
            <p className="text-sm text-(--text)/60">
              Approval-needed, in-progress, and completed incident reports tied to operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={createHref}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
            >
              + New Bonan Incident
            </Link>
            <Link
              href="/dashboard/employee"
              className="rounded-full border border-(--border)/40 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Back to Employee Portal
            </Link>
          </div>
        </div>

        <div className="tl-card p-4">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by report #, section, location, or notes"
            className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
          />
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
        ) : filteredIncidentReports.length === 0 ? (
          <div className="tl-card p-8 text-center">
            <p className="text-(--text)/70">No incident reports found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIncidentReports.map((incidentReport) => (
              <Link
                key={incidentReport.id}
                href={`/dashboard/management/incident-reports/${incidentReport.id}`}
                className="block tl-card p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-(--text)">{incidentReport.report_number}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[incidentReport.status]}`}>
                        {formatIncidentStatusLabel(incidentReport.status)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                          incidentReport.publication_status === "published"
                            ? "bg-slate-800 text-white"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {incidentReport.publication_status}
                      </span>
                    </div>
                    <p className="text-sm text-(--text)/70 line-clamp-1">{incidentReport.description}</p>
                    <p className="text-xs text-(--text)/55">
                      {[incidentReport.report_date, incidentReport.section_name, incidentReport.location].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                  <p className="text-xs text-(--text)/50">
                    Updated {new Date(incidentReport.updated_at).toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
