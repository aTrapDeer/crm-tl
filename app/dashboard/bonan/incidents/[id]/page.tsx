"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BonanReadOnlyData from "@/app/components/BonanReadOnlyData";
import BonanClientActionPanel from "@/app/components/BonanClientActionPanel";

interface IncidentReport {
  id: string;
  report_number: string;
  report_date: string;
  section_name: string;
  incident_time: string | null;
  location: string | null;
  system_area: string | null;
  description: string;
  actions_taken: string | null;
  work_order_or_vendor: string | null;
  status: string;
  updated_at: string;
}

export default function BonanClientIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [incidentReport, setIncidentReport] = useState<IncidentReport | null>(null);
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
        if (sessionData.user.role !== "client") {
          router.push(`/dashboard/management/incident-reports/${id}`);
          return;
        }

        const res = await fetch(`/api/bonan/client/incidents/${id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to load Bonan incident.");
          return;
        }

        setIncidentReport(data.incidentReport || null);
      } catch (fetchError) {
        console.error("Failed to load Bonan incident:", fetchError);
        setError("Failed to load Bonan incident.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [id, router]);

  const fieldValues = useMemo<Record<string, string>>(
    () => ({
      location: incidentReport?.location || "",
      system_area: incidentReport?.system_area || "",
      description: incidentReport?.description || "",
      actions_taken: incidentReport?.actions_taken || "",
      status: incidentReport?.status || "",
    }),
    [incidentReport]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-(--text)">Loading...</div>;
  }

  if (!incidentReport) {
    return (
      <div className="min-h-screen bg-(--bg)">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "Incident unavailable."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <header className="rounded-2xl border border-(--border)/20 bg-white/90 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-(--text)/55">Bonan Towers Incident</p>
              <h1 className="text-2xl font-bold text-(--text) mt-1">{incidentReport.report_number}</h1>
              <p className="text-sm text-(--text)/60 mt-1">
                Updated {new Date(incidentReport.updated_at).toLocaleString()}
              </p>
            </div>
            <Link href="/dashboard/bonan/incidents" className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text)">
              Back
            </Link>
          </div>
        </header>

        <BonanReadOnlyData
          title="Incident Summary"
          value={{
            report_date: incidentReport.report_date,
            section_name: incidentReport.section_name,
            incident_time: incidentReport.incident_time,
            location: incidentReport.location,
            system_area: incidentReport.system_area,
            status: incidentReport.status,
            description: incidentReport.description,
            actions_taken: incidentReport.actions_taken,
            work_order_or_vendor: incidentReport.work_order_or_vendor,
          }}
        />

        <BonanClientActionPanel
          entityType="incident_report"
          entityId={incidentReport.id}
          defaultArea={incidentReport.location || incidentReport.section_name}
          currentFieldValues={fieldValues}
          fieldOptions={[
            { value: "location", label: "Location" },
            { value: "system_area", label: "System Area" },
            { value: "description", label: "Description" },
            { value: "actions_taken", label: "Actions Taken" },
            { value: "status", label: "Status" },
          ]}
        />
      </div>
    </div>
  );
}
