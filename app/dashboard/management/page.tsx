"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WorkOrderListView from "@/app/components/WorkOrderListView";
import WorkOrderDetailsModal from "@/app/components/WorkOrderDetailsModal";
import DocumentManager from "@/app/components/DocumentManager";

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
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  completed_date: string | null;
  completed_time: string | null;
  work_summary: string | null;
  project_id: string | null;
  project_name?: string;
  created_by: string | null;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  emergency: number;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

const SERVICE_TYPES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "replace", label: "Replace" },
  { value: "inspection", label: "Inspection" },
  { value: "preventive", label: "Preventive" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
];

export default function ManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: "admin" | "worker" } | null>(null);
  const [activeTab, setActiveTab] = useState<"work-orders" | "documents">("work-orders");
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();

        if (!data.user) {
          router.push("/login");
          return;
        }

        // Only admin can access management
        if (data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setUser({ role: data.user.role });
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  const fetchWorkOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/work-orders");
      const data = await res.json();
      setWorkOrders(data.workOrders || []);
    } catch (error) {
      console.error("Failed to fetch work orders:", error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/work-orders/stats");
      const data = await res.json();
      setStats(data.stats || null);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      Promise.all([fetchWorkOrders(), fetchStats()]).finally(() => {
        setLoading(false);
      });
    }
  }, [user, fetchWorkOrders, fetchStats]);

  function handleWorkOrderUpdate(updated: WorkOrder) {
    setWorkOrders((prev) =>
      prev.map((wo) => (wo.id === updated.id ? updated : wo))
    );
    setSelectedWorkOrder(updated);
    fetchStats();
  }

  function handleWorkOrderDelete(id: string) {
    setWorkOrders((prev) => prev.filter((wo) => wo.id !== id));
    setSelectedWorkOrder(null);
    fetchStats();
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
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-(--text)">Management Portal</h1>
            <p className="text-sm text-(--text)/60">Manage work orders and documents</p>
          </div>
          {activeTab === "work-orders" && (
            <Link
              href="/dashboard/management/work-orders/new"
              className="tl-btn px-4 py-2.5 text-sm"
            >
              + New Work Order
            </Link>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="tl-card p-4">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-(--text)">{stats.total}</p>
            </div>
            <div className="tl-card p-4">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="tl-card p-4">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{stats.in_progress}</p>
            </div>
            <div className="tl-card p-4">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="tl-card p-4">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Cancelled</p>
              <p className="text-2xl font-bold text-gray-600">{stats.cancelled}</p>
            </div>
            <div className="tl-card p-4 border-2 border-red-200">
              <p className="text-xs text-red-600 uppercase tracking-wide">Emergency</p>
              <p className="text-2xl font-bold text-red-600">{stats.emergency}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-(--border)">
          <button
            onClick={() => setActiveTab("work-orders")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "work-orders"
                ? "border-(--text) text-(--text)"
                : "border-transparent text-(--text)/60 hover:text-(--text)"
            }`}
          >
            Work Orders
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "documents"
                ? "border-(--text) text-(--text)"
                : "border-transparent text-(--text)/60 hover:text-(--text)"
            }`}
          >
            Documents
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "work-orders" ? (
          <WorkOrderListView
            workOrders={workOrders}
            onSelectWorkOrder={(wo) => {
              // Find the full work order from our state
              const fullWO = workOrders.find((w) => w.id === wo.id);
              if (fullWO) setSelectedWorkOrder(fullWO);
            }}
            loading={loading}
          />
        ) : (
          <DocumentManager userRole={user.role} />
        )}
      </div>

      {/* Work Order Details Modal */}
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
