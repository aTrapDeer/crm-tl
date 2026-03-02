"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type IncidentReportStatus = "open" | "in_progress" | "closed";
type PublicationStatus = "draft" | "published";

interface IncidentReport {
  id: string;
  bonan_report_id: string;
  report_number: string;
  report_date: string;
  section_key: string | null;
  section_name: string;
  incident_time: string | null;
  location: string | null;
  system_area: string | null;
  description: string;
  actions_taken: string | null;
  work_order_or_vendor: string | null;
  status: IncidentReportStatus;
  publication_status: PublicationStatus;
  published_at: string | null;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS: Array<{ value: IncidentReportStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

function formatSavedTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IncidentReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [incidentReport, setIncidentReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [form, setForm] = useState({
    report_date: "",
    incident_time: "",
    location: "",
    system_area: "",
    description: "",
    actions_taken: "",
    work_order_or_vendor: "",
    status: "open" as IncidentReportStatus,
  });

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

        const reportRes = await fetch(`/api/incident-reports/${id}`);
        const reportData = await reportRes.json();
        if (!reportRes.ok) {
          setError(reportData.error || "Failed to load incident report.");
          return;
        }

        const report = reportData.incidentReport as IncidentReport;
        setIncidentReport(report);
        setForm({
          report_date: report.report_date || "",
          incident_time: report.incident_time || "",
          location: report.location || "",
          system_area: report.system_area || "",
          description: report.description || "",
          actions_taken: report.actions_taken || "",
          work_order_or_vendor: report.work_order_or_vendor || "",
          status: report.status,
        });
      } catch {
        setError("Failed to load incident report.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [id, router]);

  const isPublished = incidentReport?.publication_status === "published";

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (!isPublished && saveMessage) {
      setSaveMessage("");
    }
  }

  async function handleSave() {
    if (!incidentReport || saving || isPublished) return;

    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await fetch(`/api/incident-reports/${incidentReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_date: form.report_date,
          incident_time: form.incident_time,
          location: form.location,
          system_area: form.system_area,
          description: form.description,
          actions_taken: form.actions_taken,
          work_order_or_vendor: form.work_order_or_vendor,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update incident report.");
        return;
      }
      const updatedReport = data.incidentReport as IncidentReport;
      setIncidentReport(updatedReport);
      if (updatedReport.publication_status === "draft") {
        setSaveMessage(`Draft saved at ${formatSavedTime(new Date())}`);
      }
    } catch {
      setError("Failed to update incident report.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!incidentReport || publishing || isPublished) return;

    setPublishing(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await fetch(`/api/incident-reports/${incidentReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publication_status: "published",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to publish incident report.");
        return;
      }
      setIncidentReport(data.incidentReport as IncidentReport);
      setSaveMessage("Incident report published. Editing is now locked.");
    } catch {
      setError("Failed to publish incident report.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text)"></div>
      </div>
    );
  }

  if (!incidentReport) {
    return (
      <div className="min-h-screen bg-(--bg)">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="tl-card p-6">
            <h1 className="text-lg font-semibold text-(--text)">Unable to load incident report</h1>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <Link href="/dashboard/management" className="mt-4 inline-flex text-sm font-medium text-blue-600">
              Back to Management
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = `w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm ${
    isPublished ? "opacity-75 cursor-not-allowed" : ""
  }`;

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold text-(--text)">
              Incident Report {incidentReport.report_number}
            </h1>
            <p className="text-xs md:text-sm text-(--text)/60">
              Linked section: {incidentReport.section_name} - Created by {incidentReport.creator_name || "Unknown"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  incidentReport.publication_status === "published"
                    ? "bg-slate-800 text-white"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {incidentReport.publication_status}
              </span>
              {incidentReport.published_at && (
                <span className="text-[11px] text-(--text)/50">
                  Published {new Date(incidentReport.published_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <Link
            href="/dashboard/management"
            className="inline-flex w-fit rounded-lg border border-(--border)/30 px-3 py-2 text-sm text-(--text)"
          >
            Back
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {saveMessage && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {saveMessage}
          </div>
        )}

        {isPublished && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
            This report is published and locked. No further edits are allowed.
          </div>
        )}

        <section className="tl-card p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-(--text)/60">Report Date</span>
              <input
                type="date"
                value={form.report_date}
                onChange={(event) => updateField("report_date", event.target.value)}
                disabled={isPublished}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Incident Time</span>
              <input
                type="time"
                value={form.incident_time}
                onChange={(event) => updateField("incident_time", event.target.value)}
                disabled={isPublished}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Location</span>
              <input
                type="text"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                disabled={isPublished}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">System / Area</span>
              <input
                type="text"
                value={form.system_area}
                onChange={(event) => updateField("system_area", event.target.value)}
                disabled={isPublished}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-(--text)/60">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                rows={4}
                disabled={isPublished}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-(--text)/60">Immediate Actions / Follow-up</span>
              <textarea
                value={form.actions_taken}
                onChange={(event) => updateField("actions_taken", event.target.value)}
                rows={3}
                disabled={isPublished}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Work Order / Vendor</span>
              <input
                type="text"
                value={form.work_order_or_vendor}
                onChange={(event) => updateField("work_order_or_vendor", event.target.value)}
                disabled={isPublished}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Status</span>
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value as IncidentReportStatus)}
                disabled={isPublished}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {!isPublished && (
          <div className="sticky bottom-0 bg-(--bg)/95 backdrop-blur border-t border-(--border) px-1 py-3">
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing || saving}
                className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60"
              >
                {publishing ? "Publishing..." : "Publish Incident Report"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || publishing}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Draft Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
