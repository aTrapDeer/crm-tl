"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface IncidentReport {
  id: string;
  report_number: string;
  report_date: string;
  section_name: string;
  location: string | null;
  description: string;
  status: "open" | "in_progress" | "closed";
}

function formatIncidentStatusLabel(status: IncidentReport["status"]) {
  if (status === "open") return "Approval Needed";
  return status.replace(/_/g, " ");
}

export default function BonanClientIncidentsPage() {
  const router = useRouter();
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
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
          router.push("/dashboard/management?tab=incident-reports&site=bonan_towers");
          return;
        }

        const res = await fetch("/api/bonan/client/incidents");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to load Bonan incidents.");
          return;
        }

        setIncidentReports(data.incidentReports || []);
      } catch (fetchError) {
        console.error("Failed to load Bonan incidents:", fetchError);
        setError("Failed to load Bonan incidents.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [router]);

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--text)/55">Bonan Towers</p>
            <h1 className="text-2xl font-bold text-(--text)">Bonan Incident Reports</h1>
            <p className="text-sm text-(--text)/60 mt-1">Review approval-needed drafts plus any incident reports that have already been published to the client portal.</p>
          </div>
          <Link href="/dashboard/bonan" className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text)">
            Back to Bonan
          </Link>
        </div>

        {loading ? (
          <div className="tl-card p-6 text-sm text-(--text)/60">Loading incident reports...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : incidentReports.length === 0 ? (
          <div className="tl-card p-6 text-sm text-(--text)/60">No Bonan incident reports are available for client review yet.</div>
        ) : (
          <div className="space-y-3">
            {incidentReports.map((incident) => (
              <Link key={incident.id} href={`/dashboard/bonan/incidents/${incident.id}`} className="block rounded-2xl border border-(--border)/20 bg-white/90 p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-(--text)">{incident.report_number}</p>
                    <p className="text-sm text-(--text)/70 mt-1">{incident.description}</p>
                    <p className="text-xs text-(--text)/55 mt-2">
                      {[incident.report_date, incident.section_name, incident.location].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize">
                    {formatIncidentStatusLabel(incident.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
