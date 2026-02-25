"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type IncidentReportStatus = "open" | "in_progress" | "closed";

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
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS: Array<{ value: IncidentReportStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

export default function IncidentReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [incidentReport, setIncidentReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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

  async function handleSave() {
    if (!incidentReport || saving) return;

    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }

    setSaving(true);
    setError("");
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
      setIncidentReport(data.incidentReport as IncidentReport);
    } catch {
      setError("Failed to update incident report.");
    } finally {
      setSaving(false);
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

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-(--text)">Incident Report {incidentReport.report_number}</h1>
            <p className="text-sm text-(--text)/60">
              Linked section: {incidentReport.section_name} · Created by {incidentReport.creator_name || "Unknown"}
            </p>
          </div>
          <Link href="/dashboard/management" className="rounded-lg border border-(--border)/30 px-3 py-2 text-sm text-(--text)">
            Back
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="tl-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-(--text)/60">Report Date</span>
              <input
                type="date"
                value={form.report_date}
                onChange={(event) => setForm((current) => ({ ...current, report_date: event.target.value }))}
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Incident Time</span>
              <input
                type="time"
                value={form.incident_time}
                onChange={(event) => setForm((current) => ({ ...current, incident_time: event.target.value }))}
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Location</span>
              <input
                type="text"
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">System / Area</span>
              <input
                type="text"
                value={form.system_area}
                onChange={(event) => setForm((current) => ({ ...current, system_area: event.target.value }))}
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-(--text)/60">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-(--text)/60">Immediate Actions / Follow-up</span>
              <textarea
                value={form.actions_taken}
                onChange={(event) => setForm((current) => ({ ...current, actions_taken: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Work Order / Vendor</span>
              <input
                type="text"
                value={form.work_order_or_vendor}
                onChange={(event) => setForm((current) => ({ ...current, work_order_or_vendor: event.target.value }))}
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-(--text)/60">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as IncidentReportStatus,
                  }))
                }
                className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
