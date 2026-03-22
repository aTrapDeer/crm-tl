"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import WorkOrderListView from "@/app/components/WorkOrderListView";
import WorkOrderDetailsModal from "@/app/components/WorkOrderDetailsModal";
import DocumentManager from "@/app/components/DocumentManager";
import { ModalLayer } from "@/app/components/ModalLayer";

type ManagementTab = "work-orders" | "incident-reports" | "documents";
type SiteFilter = "all" | "bonan_towers";
type WorkOrderStatus = "pending" | "in_progress" | "completed" | "cancelled";
type IncidentStatus = "open" | "in_progress" | "closed";

interface WorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  time_received: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  department: string | null;
  location: string | null;
  unit: string | null;
  area: string | null;
  access_needed: string | null;
  preferred_entry_time: string | null;
  priority: "emergency" | "high" | "normal" | "low";
  service_type: "maintenance" | "repair" | "replace" | "inspection" | "preventive" | "cleaning" | "other";
  description: string;
  assigned_to: string | null;
  assigned_user_name?: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  time_in: string | null;
  time_out: string | null;
  total_labor_hours: number | null;
  work_completed: WorkOrderStatus;
  completed_date: string | null;
  completed_time: string | null;
  work_summary: string | null;
  project_id: string | null;
  project_name?: string;
  site: "bonan_towers" | null;
  publication_status: "draft" | "published";
  created_by: string | null;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

interface IncidentReport {
  id: string;
  report_number: string;
  report_date: string;
  section_name: string;
  location: string | null;
  status: IncidentStatus;
  description: string;
  site: "bonan_towers" | null;
  publication_status: "draft" | "published";
  created_at: string;
}

type WorkOrderModalUpdate = Omit<WorkOrder, "site" | "publication_status">;

const WORK_ORDER_STATUS_VALUES: WorkOrderStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

const INCIDENT_STATUS_VALUES: IncidentStatus[] = [
  "open",
  "in_progress",
  "closed",
];

function parseStatuses<T extends string>(value: string | null, allowed: readonly T[]) {
  if (!value) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is T => allowed.includes(entry as T));
}

function formatIncidentStatusLabel(status: IncidentStatus) {
  if (status === "open") return "Approval Needed";
  return status === "in_progress" ? "In Progress" : status[0].toUpperCase() + status.slice(1);
}

function WorkOrderStatCard({
  href,
  label,
  value,
  valueClassName,
  infoMessage,
  infoOpen,
  onToggleInfo,
}: {
  href: string;
  label: string;
  value: number;
  valueClassName: string;
  infoMessage?: string;
  infoOpen?: boolean;
  onToggleInfo?: () => void;
}) {
  return (
    <div className="group relative">
      <Link href={href} className="tl-card block p-4 pr-12 transition hover:-translate-y-0.5 hover:shadow-md">
        <p className="text-xs text-(--text)/60 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
      </Link>
      {infoMessage && onToggleInfo && (
        <>
          <button
            type="button"
            aria-label={`${label} status info`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleInfo();
            }}
            className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-(--border)/30 bg-white text-[11px] font-semibold text-(--text)/70 shadow-sm transition hover:bg-(--bg)"
          >
            i
          </button>
          <div
            role="tooltip"
            className={`pointer-events-none absolute right-3 top-10 z-10 w-56 rounded-xl border border-(--border)/20 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg transition ${
              infoOpen ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            }`}
          >
            {infoMessage}
          </div>
        </>
      )}
    </div>
  );
}

export default function ManagementPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ role: "admin" } | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [pendingDeleteWorkOrder, setPendingDeleteWorkOrder] = useState<WorkOrder | null>(null);
  const [deleteWorkOrderConfirmInput, setDeleteWorkOrderConfirmInput] = useState("");
  const [deleteWorkOrderError, setDeleteWorkOrderError] = useState("");
  const [deletingWorkOrder, setDeletingWorkOrder] = useState(false);
  const [activeWorkOrderInfo, setActiveWorkOrderInfo] = useState<"pending" | "in_progress" | null>(null);

  const activeTab: ManagementTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (
      tab === "work-orders" ||
      tab === "incident-reports" ||
      tab === "documents"
    ) {
      return tab;
    }
    return "work-orders";
  }, [searchParams]);

  const siteFilter: SiteFilter = searchParams.get("site") === "bonan_towers" ? "bonan_towers" : "all";
  const workOrderStatuses = useMemo(
    () => parseStatuses(searchParams.get("statuses") || searchParams.get("status"), WORK_ORDER_STATUS_VALUES),
    [searchParams]
  );
  const incidentStatuses = useMemo(
    () => parseStatuses(searchParams.get("incidentStatus") || searchParams.get("statuses"), INCIDENT_STATUS_VALUES),
    [searchParams]
  );
  const showBonanQuickCreate = siteFilter === "bonan_towers" && activeTab !== "documents";
  const currentViewHref = useMemo(
    () => (searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname),
    [pathname, searchParams]
  );
  const bonanWorkOrderCreateHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("site", "bonan_towers");
    params.set("returnTo", currentViewHref);
    return `/dashboard/management/work-orders/new?${params.toString()}`;
  }, [currentViewHref]);
  const bonanIncidentCreateHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("site", "bonan_towers");
    params.set("returnTo", currentViewHref);
    return `/dashboard/management/incident-reports/new?${params.toString()}`;
  }, [currentViewHref]);
  const fullWorkOrderCreateHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("returnTo", currentViewHref);
    return `/dashboard/management/work-orders/new?${params.toString()}`;
  }, [currentViewHref]);

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl);
    },
    [pathname, router, searchParams]
  );

  const buildHref = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      return params.toString() ? `${pathname}?${params.toString()}` : pathname;
    },
    [pathname, searchParams]
  );

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();

        if (!data.user) {
          router.push("/login");
          return;
        }

        if (data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setUser({ role: "admin" });
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      }
    }

    void checkAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [workOrdersRes, incidentReportsRes] = await Promise.all([
          fetch("/api/work-orders"),
          fetch("/api/incident-reports"),
        ]);
        const [workOrdersData, incidentReportsData] = await Promise.all([
          workOrdersRes.json(),
          incidentReportsRes.json(),
        ]);

        if (!cancelled) {
          setWorkOrders(workOrdersData.workOrders || []);
          setIncidentReports(incidentReportsData.incidentReports || []);
        }
      } catch (error) {
        console.error("Failed to load management data:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const workOrdersBySite = useMemo(
    () =>
      siteFilter === "bonan_towers"
        ? workOrders.filter((workOrder) => workOrder.site === "bonan_towers")
        : workOrders,
    [siteFilter, workOrders]
  );

  const incidentReportsBySite = useMemo(
    () =>
      siteFilter === "bonan_towers"
        ? incidentReports.filter((incident) => incident.site === "bonan_towers")
        : incidentReports,
    [incidentReports, siteFilter]
  );

  const filteredWorkOrders = useMemo(
    () =>
      workOrderStatuses.length === 0
        ? workOrdersBySite
        : workOrdersBySite.filter((workOrder) => workOrderStatuses.includes(workOrder.work_completed)),
    [workOrderStatuses, workOrdersBySite]
  );

  const filteredIncidentReports = useMemo(
    () =>
      incidentStatuses.length === 0
        ? incidentReportsBySite
        : incidentReportsBySite.filter((incident) => incidentStatuses.includes(incident.status)),
    [incidentReportsBySite, incidentStatuses]
  );

  const workOrderStats = useMemo(
    () => ({
      total: workOrdersBySite.length,
      pending: workOrdersBySite.filter((workOrder) => workOrder.work_completed === "pending").length,
      in_progress: workOrdersBySite.filter((workOrder) => workOrder.work_completed === "in_progress").length,
      completed: workOrdersBySite.filter((workOrder) => workOrder.work_completed === "completed").length,
      cancelled: workOrdersBySite.filter((workOrder) => workOrder.work_completed === "cancelled").length,
      emergency: workOrdersBySite.filter(
        (workOrder) =>
          workOrder.priority === "emergency" &&
          workOrder.work_completed !== "completed" &&
          workOrder.work_completed !== "cancelled"
      ).length,
    }),
    [workOrdersBySite]
  );

  const incidentStats = useMemo(
    () => ({
      total: incidentReportsBySite.length,
      open: incidentReportsBySite.filter((incident) => incident.status === "open").length,
      in_progress: incidentReportsBySite.filter((incident) => incident.status === "in_progress").length,
      closed: incidentReportsBySite.filter((incident) => incident.status === "closed").length,
    }),
    [incidentReportsBySite]
  );

  function handleWorkOrderUpdate(updated: WorkOrderModalUpdate) {
    setWorkOrders((current) =>
      current.map((workOrder) =>
        workOrder.id === updated.id
          ? { ...workOrder, ...updated }
          : workOrder
      )
    );
    setSelectedWorkOrder((current) =>
      current && current.id === updated.id ? { ...current, ...updated } : current
    );
  }

  function handleWorkOrderDelete(id: string) {
    setWorkOrders((current) => current.filter((workOrder) => workOrder.id !== id));
    setSelectedWorkOrder(null);
  }

  function openDeleteWorkOrderWarning(workOrder: WorkOrder) {
    setPendingDeleteWorkOrder(workOrder);
    setDeleteWorkOrderConfirmInput("");
    setDeleteWorkOrderError("");
  }

  async function handleConfirmDeleteWorkOrder() {
    if (!pendingDeleteWorkOrder || deletingWorkOrder) return;

    if (deleteWorkOrderConfirmInput.trim() !== pendingDeleteWorkOrder.work_order_number) {
      setDeleteWorkOrderError(`Type ${pendingDeleteWorkOrder.work_order_number} to confirm deletion.`);
      return;
    }

    setDeletingWorkOrder(true);
    setDeleteWorkOrderError("");
    try {
      const res = await fetch(`/api/work-orders/${pendingDeleteWorkOrder.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteWorkOrderError(data.error || "Failed to delete work order.");
        return;
      }

      handleWorkOrderDelete(pendingDeleteWorkOrder.id);
      setPendingDeleteWorkOrder(null);
      setDeleteWorkOrderConfirmInput("");
    } catch (error) {
      console.error("Failed to delete work order:", error);
      setDeleteWorkOrderError("Failed to delete work order.");
    } finally {
      setDeletingWorkOrder(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-(--text)">Management Portal</h1>
            <p className="text-sm text-(--text)/60">Manage work orders, incident reports, and documents</p>
          </div>
          {activeTab === "work-orders" ? (
            <div className="flex items-center gap-2">
              {siteFilter === "bonan_towers" && (
                <Link
                  href={bonanWorkOrderCreateHref}
                  className="rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  + New Bonan Work Order
                </Link>
              )}
              <Link
                href={fullWorkOrderCreateHref}
                className={`${siteFilter === "bonan_towers" ? "rounded-full border border-(--border)/30 bg-white text-(--text) hover:bg-(--bg)" : "tl-btn"} px-4 py-2.5 text-sm`}
              >
                {siteFilter === "bonan_towers" ? "Full Work Order Form" : "+ New Work Order"}
              </Link>
            </div>
          ) : activeTab === "incident-reports" && siteFilter === "bonan_towers" ? (
            <div className="flex items-center gap-2">
              <Link
                href={bonanIncidentCreateHref}
                className="rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                + New Bonan Incident
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-(--border)/15 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--text)/55">View Filter</p>
            <p className="text-sm text-(--text)/65">
              URL filters control the current management view and can be linked from dashboards.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateQuery({ site: null })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                siteFilter === "all"
                  ? "bg-(--text) text-white"
                  : "border border-(--border)/30 text-(--text) hover:bg-(--bg)"
              }`}
            >
              All Sites
            </button>
            <button
              type="button"
              onClick={() => updateQuery({ site: "bonan_towers" })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                siteFilter === "bonan_towers"
                  ? "bg-(--text) text-white"
                  : "border border-(--border)/30 text-(--text) hover:bg-(--bg)"
              }`}
            >
              Bonan Towers
            </button>
          </div>
        </div>

        {showBonanQuickCreate && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-blue-900">Bonan isolated event creation</p>
            <p className="mt-1 text-xs text-blue-800/85">
              Use the Bonan create page on this tab for incidents or work orders that were not
              captured during a walkthrough. The record stays tagged to Bonan Towers and is linked
              into the appropriate Bonan reporting period for monthly reporting and related
              rollups.
            </p>
          </div>
        )}

        {activeTab === "work-orders" && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Link href={buildHref({ tab: "work-orders", statuses: null })} className="tl-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-(--text)">{workOrderStats.total}</p>
            </Link>
            <WorkOrderStatCard
              href={buildHref({ tab: "work-orders", statuses: "pending" })}
              label="Approval Needed"
              value={workOrderStats.pending}
              valueClassName="text-yellow-600"
              infoMessage="Waiting for client approval before work can start."
              infoOpen={activeWorkOrderInfo === "pending"}
              onToggleInfo={() =>
                setActiveWorkOrderInfo((current) => (current === "pending" ? null : "pending"))
              }
            />
            <WorkOrderStatCard
              href={buildHref({ tab: "work-orders", statuses: "in_progress" })}
              label="In Progress"
              value={workOrderStats.in_progress}
              valueClassName="text-blue-600"
              infoMessage="Employees will start working on this soon."
              infoOpen={activeWorkOrderInfo === "in_progress"}
              onToggleInfo={() =>
                setActiveWorkOrderInfo((current) => (current === "in_progress" ? null : "in_progress"))
              }
            />
            <Link href={buildHref({ tab: "work-orders", statuses: "completed" })} className="tl-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Completed</p>
              <p className="text-2xl font-bold text-green-600">{workOrderStats.completed}</p>
            </Link>
            <Link href={buildHref({ tab: "work-orders", statuses: "cancelled" })} className="tl-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Cancelled</p>
              <p className="text-2xl font-bold text-gray-600">{workOrderStats.cancelled}</p>
            </Link>
            <div className="tl-card p-4 border-2 border-red-200">
              <p className="text-xs text-red-600 uppercase tracking-wide">Emergency</p>
              <p className="text-2xl font-bold text-red-600">{workOrderStats.emergency}</p>
            </div>
          </div>
        )}

        {activeTab === "incident-reports" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href={buildHref({ tab: "incident-reports", incidentStatus: null })} className="tl-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-(--text)">{incidentStats.total}</p>
            </Link>
            <Link href={buildHref({ tab: "incident-reports", incidentStatus: "open" })} className="tl-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Approval Needed</p>
              <p className="text-2xl font-bold text-amber-600">{incidentStats.open}</p>
            </Link>
            <Link href={buildHref({ tab: "incident-reports", incidentStatus: "in_progress" })} className="tl-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{incidentStats.in_progress}</p>
            </Link>
            <Link href={buildHref({ tab: "incident-reports", incidentStatus: "closed" })} className="tl-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Closed</p>
              <p className="text-2xl font-bold text-green-600">{incidentStats.closed}</p>
            </Link>
          </div>
        )}

        <div className="flex gap-2 border-b border-(--border)">
          <button
            onClick={() => updateQuery({ tab: "work-orders" })}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "work-orders"
                ? "border-(--text) text-(--text)"
                : "border-transparent text-(--text)/60 hover:text-(--text)"
            }`}
          >
            Work Orders
          </button>
          <button
            onClick={() => updateQuery({ tab: "incident-reports" })}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "incident-reports"
                ? "border-(--text) text-(--text)"
                : "border-transparent text-(--text)/60 hover:text-(--text)"
            }`}
          >
            Incident Reports
          </button>
          <button
            onClick={() => updateQuery({ tab: "documents" })}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "documents"
                ? "border-(--text) text-(--text)"
                : "border-transparent text-(--text)/60 hover:text-(--text)"
            }`}
          >
            Documents
          </button>
        </div>

        {activeTab === "work-orders" ? (
          <WorkOrderListView
            workOrders={filteredWorkOrders}
            onSelectWorkOrder={(workOrder) => {
              const fullWorkOrder = workOrders.find((entry) => entry.id === workOrder.id);
              if (fullWorkOrder) setSelectedWorkOrder(fullWorkOrder);
            }}
            onEditWorkOrder={(workOrder) => {
              router.push(`/dashboard/management/work-orders/${workOrder.id}/edit`);
            }}
            onDeleteWorkOrder={(workOrder) => openDeleteWorkOrderWarning(workOrder as WorkOrder)}
            loading={loading}
          />
        ) : activeTab === "incident-reports" ? (
          <div className="tl-card overflow-hidden">
            {loading ? (
              <div className="p-6 text-sm text-(--text)/60">Loading incident reports...</div>
            ) : filteredIncidentReports.length === 0 ? (
              <div className="p-6 text-sm text-(--text)/60">No incident reports found for the current filters.</div>
            ) : (
              <div className="divide-y divide-(--border)/10">
                {filteredIncidentReports.map((incident) => (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/management/incident-reports/${incident.id}`)}
                    className="w-full px-4 py-3 text-left hover:bg-(--bg) transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-(--text)">
                          {incident.report_number} · {incident.section_name}
                        </p>
                        <p className="text-xs text-(--text)/55 mt-1 truncate">
                          {incident.location || "Bonan Towers"} · {incident.description}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            incident.status === "closed"
                              ? "bg-green-100 text-green-700"
                              : incident.status === "in_progress"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {formatIncidentStatusLabel(incident.status)}
                        </span>
                        <p className="text-[10px] text-(--text)/50 mt-1">{incident.report_date}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <DocumentManager userRole={user.role} />
        )}
      </div>

      {pendingDeleteWorkOrder && (
        <ModalLayer
          align="center"
          className="bg-black/50"
          onBackdropClick={() => {
            if (deletingWorkOrder) return;
            setPendingDeleteWorkOrder(null);
            setDeleteWorkOrderConfirmInput("");
            setDeleteWorkOrderError("");
          }}
        >
          <div className="tl-card p-6 w-full max-w-md space-y-4" onClick={(event) => event.stopPropagation()}>
            <div>
              <h3 className="text-lg font-semibold text-red-700">Delete Work Order Warning</h3>
              <p className="text-sm text-(--text)/75 mt-2">
                This will permanently delete work order <strong>{pendingDeleteWorkOrder.work_order_number}</strong>.
              </p>
              <p className="text-sm text-(--text)/75 mt-1">Type the work order number to confirm.</p>
            </div>
            <input
              type="text"
              value={deleteWorkOrderConfirmInput}
              onChange={(event) => {
                setDeleteWorkOrderConfirmInput(event.target.value);
                if (deleteWorkOrderError) setDeleteWorkOrderError("");
              }}
              placeholder={`Type ${pendingDeleteWorkOrder.work_order_number}`}
              className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/40 text-(--text) focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            {deleteWorkOrderError && (
              <p className="text-sm text-red-700">{deleteWorkOrderError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (deletingWorkOrder) return;
                  setPendingDeleteWorkOrder(null);
                  setDeleteWorkOrderConfirmInput("");
                  setDeleteWorkOrderError("");
                }}
                className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteWorkOrder()}
                disabled={deletingWorkOrder}
                className="flex-1 rounded-full bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 transition disabled:opacity-60"
              >
                {deletingWorkOrder ? "Deleting..." : "Delete Now"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}

      {selectedWorkOrder && (
        <WorkOrderDetailsModal
          workOrder={selectedWorkOrder}
          onClose={() => setSelectedWorkOrder(null)}
          userRole={user.role}
          onWorkOrderUpdate={handleWorkOrderUpdate}
          onWorkOrderDelete={handleWorkOrderDelete}
        />
      )}
    </div>
  );
}
