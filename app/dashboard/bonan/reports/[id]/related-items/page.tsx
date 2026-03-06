"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

type ReportType = "daily" | "weekly" | "monthly";

interface RelatedIncidentReport {
  id: string;
  report_number: string;
  report_date: string;
  section_name: string;
  location: string | null;
  status: "open" | "in_progress" | "closed";
  publication_status: "draft" | "published";
  description: string;
}

interface RelatedWorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  location: string | null;
  area: string | null;
  priority: "emergency" | "high" | "normal" | "low";
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  publication_status: "draft" | "published";
  description: string;
}

interface RelatedItemsResponse {
  report_id: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  incident_reports: RelatedIncidentReport[];
  work_orders: RelatedWorkOrder[];
}

const INCIDENT_STATUS_STYLES: Record<RelatedIncidentReport["status"], string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700",
};

const WORK_ORDER_STATUS_STYLES: Record<RelatedWorkOrder["work_completed"], string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-700",
};

function getBackLink(reportType: ReportType, reportId: string, userRole: "admin" | "employee" | "client" | null) {
  if (reportType === "daily") return `/dashboard/bonan/daily/${reportId}`;
  if (reportType === "weekly") return `/dashboard/bonan/weekly/${reportId}`;
  if (userRole === "client") return `/dashboard/bonan/monthly-summaries/${reportId}`;
  return `/dashboard/bonan/monthly/${reportId}`;
}

export default function BonanRelatedItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [relatedItems, setRelatedItems] = useState<RelatedItemsResponse | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "employee" | "client" | null>(null);

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

        const relatedRes = await fetch(`/api/bonan/reports/${id}/related-items`);
        const relatedData = await relatedRes.json().catch(() => ({}));
        if (!relatedRes.ok) {
          setError(relatedData.error || "Failed to load related items.");
          return;
        }

        setRelatedItems(relatedData.relatedItems as RelatedItemsResponse);
      } catch (fetchError) {
        console.error("Failed to load related items:", fetchError);
        setError("Failed to load related items.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [id, router]);

  useEffect(() => {
    if (!focus || loading) return;
    const targetId = focus === "work-orders" ? "related-work-orders" : "related-incidents";
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus, loading]);

  const backLink = useMemo(() => {
    if (!relatedItems) return "/dashboard/bonan";
    return getBackLink(relatedItems.report_type, relatedItems.report_id, userRole);
  }, [relatedItems, userRole]);
  const workOrderDetailBase = userRole === "client" ? "/dashboard/bonan/work-orders" : "/dashboard/management/work-orders";
  const incidentDetailBase = userRole === "client" ? "/dashboard/bonan/incidents" : "/dashboard/management/incident-reports";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  if (!relatedItems) {
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Link href="/dashboard/bonan" className="inline-flex text-sm font-medium text-blue-700 hover:underline">
            Back to Bonan Reports
          </Link>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || "Related items unavailable."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="tl-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-(--text)/55">Bonan Related Items</p>
              <h1 className="text-2xl font-bold text-(--text)">Connected Work Orders & Incident Reports</h1>
              <p className="text-sm text-(--text)/60 mt-1">
                Period: {relatedItems.period_start} to {relatedItems.period_end}
              </p>
            </div>
            <Link
              href={backLink}
              className="rounded-full border border-(--border)/40 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Back to Report
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="#related-work-orders" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 block hover:shadow-sm transition">
              <p className="text-xs uppercase tracking-wide text-blue-700">Work Orders</p>
              <p className="text-2xl font-bold text-blue-900">{relatedItems.work_orders.length}</p>
            </a>
            <a href="#related-incidents" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 block hover:shadow-sm transition">
              <p className="text-xs uppercase tracking-wide text-red-700">Incident Reports</p>
              <p className="text-2xl font-bold text-red-900">{relatedItems.incident_reports.length}</p>
            </a>
          </div>
        </header>

        <section id="related-work-orders" className="tl-card p-5 space-y-3">
          <h2 className="text-lg font-semibold text-(--text)">Work Orders</h2>
          {relatedItems.work_orders.length === 0 ? (
            <p className="text-sm text-(--text)/60">No related work orders in this period.</p>
          ) : (
            <div className="space-y-3">
              {relatedItems.work_orders.map((workOrder) => (
                <Link
                  key={workOrder.id}
                  href={`${workOrderDetailBase}/${workOrder.id}`}
                  className="block rounded-xl border border-(--border)/25 p-4 hover:bg-(--bg) transition"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-(--text)">{workOrder.work_order_number}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${WORK_ORDER_STATUS_STYLES[workOrder.work_completed]}`}>
                          {workOrder.work_completed.replace("_", " ")}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${workOrder.priority === "emergency" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                          {workOrder.priority}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${workOrder.publication_status === "published" ? "bg-slate-800 text-white" : "bg-amber-100 text-amber-700"}`}>
                          {workOrder.publication_status}
                        </span>
                      </div>
                      <p className="text-sm text-(--text)/70 line-clamp-1">{workOrder.description}</p>
                      <p className="text-xs text-(--text)/55">
                        {[workOrder.date, workOrder.location, workOrder.area].filter(Boolean).join(" - ")}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="related-incidents" className="tl-card p-5 space-y-3">
          <h2 className="text-lg font-semibold text-(--text)">Incident Reports</h2>
          {relatedItems.incident_reports.length === 0 ? (
            <p className="text-sm text-(--text)/60">No related incident reports in this period.</p>
          ) : (
            <div className="space-y-3">
              {relatedItems.incident_reports.map((incidentReport) => (
                <Link
                  key={incidentReport.id}
                  href={`${incidentDetailBase}/${incidentReport.id}`}
                  className="block rounded-xl border border-(--border)/25 p-4 hover:bg-(--bg) transition"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-(--text)">{incidentReport.report_number}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INCIDENT_STATUS_STYLES[incidentReport.status]}`}>
                          {incidentReport.status.replace("_", " ")}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${incidentReport.publication_status === "published" ? "bg-slate-800 text-white" : "bg-amber-100 text-amber-700"}`}>
                          {incidentReport.publication_status}
                        </span>
                      </div>
                      <p className="text-sm text-(--text)/70 line-clamp-1">{incidentReport.description}</p>
                      <p className="text-xs text-(--text)/55">
                        {[incidentReport.report_date, incidentReport.section_name, incidentReport.location].filter(Boolean).join(" - ")}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
