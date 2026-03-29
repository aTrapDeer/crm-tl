"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface WorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  location: string | null;
  area: string | null;
  description: string;
  priority: "emergency" | "high" | "normal" | "low";
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  assigned_user_name?: string;
  updated_at: string;
}

const PRIORITY_STYLES: Record<WorkOrder["priority"], string> = {
  emergency: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-700",
};

const STATUS_STYLES: Record<WorkOrder["work_completed"], string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-700",
};

function formatWorkOrderStatusLabel(status: WorkOrder["work_completed"]) {
  if (status === "pending") return "Approval Needed";
  return status.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function EmployeeWorkOrdersPage() {
  const router = useRouter();
  const createHref = "/dashboard/management/work-orders/new?site=bonan_towers&returnTo=/dashboard/work-orders";
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
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

        const workOrdersRes = await fetch("/api/work-orders");
        const workOrdersData = await workOrdersRes.json();
        if (!workOrdersRes.ok) {
          setError(workOrdersData.error || "Failed to load work orders.");
          return;
        }

        setWorkOrders((workOrdersData.workOrders || []) as WorkOrder[]);
      } catch (fetchError) {
        console.error("Failed to load employee work orders:", fetchError);
        setError("Failed to load work orders.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  const filteredWorkOrders = useMemo(() => {
    if (!search.trim()) return workOrders;
    const term = search.trim().toLowerCase();
    return workOrders.filter((workOrder) => {
      return (
        workOrder.work_order_number.toLowerCase().includes(term) ||
        (workOrder.location || "").toLowerCase().includes(term) ||
        (workOrder.area || "").toLowerCase().includes(term) ||
        workOrder.description.toLowerCase().includes(term)
      );
    });
  }, [search, workOrders]);

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-(--text)">Work Orders</h1>
            <p className="text-sm text-(--text)/60">
              All work orders you can open, update, and self-assign. Opening a work order assigns it to you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={createHref}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              + New Bonan Work Order
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
            placeholder="Search work orders by #, location, area, or notes"
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
        ) : filteredWorkOrders.length === 0 ? (
          <div className="tl-card p-8 text-center">
            <p className="text-(--text)/70">No work orders found.</p>
            <p className="text-sm text-(--text)/50 mt-1">
              New orders tied to your daily walkthrough sections or created from Bonan follow-up will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorkOrders.map((workOrder) => (
              <Link
                key={workOrder.id}
                href={`/dashboard/management/work-orders/${workOrder.id}`}
                className="block tl-card p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-(--text)">{workOrder.work_order_number}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[workOrder.priority]}`}>
                        {workOrder.priority}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[workOrder.work_completed]}`}>
                        {formatWorkOrderStatusLabel(workOrder.work_completed)}
                      </span>
                    </div>
                    <p className="text-sm text-(--text)/70 line-clamp-1">{workOrder.description}</p>
                    <p className="text-xs text-(--text)/55">
                      {[workOrder.location, workOrder.area].filter(Boolean).join(" - ") || "Location pending"}
                    </p>
                  </div>
                  <p className="text-xs text-(--text)/50">
                    Updated {new Date(workOrder.updated_at).toLocaleString()}
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
