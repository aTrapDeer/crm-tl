"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

  // Create work order modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newWorkOrder, setNewWorkOrder] = useState({
    date: new Date().toISOString().slice(0, 10),
    time_received: new Date().toTimeString().slice(0, 5),
    phone: "",
    email: "",
    company: "",
    department: "",
    location: "",
    unit: "",
    area: "",
    access_needed: "",
    preferred_entry_time: "",
    priority: "normal" as WorkOrder["priority"],
    service_type: "maintenance" as WorkOrder["service_type"],
    description: "",
    assigned_to: "",
    scheduled_date: "",
    scheduled_time: "",
    project_id: "",
  });

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

  const fetchUsersAndProjects = useCallback(async () => {
    try {
      const [usersRes, projectsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/projects"),
      ]);
      const usersData = await usersRes.json();
      const projectsData = await projectsRes.json();
      setUsers((usersData.users || []).filter((u: User) => u.role !== "client"));
      setProjects(projectsData.projects || []);
    } catch (error) {
      console.error("Failed to fetch users/projects:", error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      Promise.all([fetchWorkOrders(), fetchStats(), fetchUsersAndProjects()]).finally(() => {
        setLoading(false);
      });
    }
  }, [user, fetchWorkOrders, fetchStats, fetchUsersAndProjects]);

  async function handleCreateWorkOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkOrder.description.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newWorkOrder,
          assigned_to: newWorkOrder.assigned_to || null,
          project_id: newWorkOrder.project_id || null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewWorkOrder({
          date: new Date().toISOString().slice(0, 10),
          time_received: new Date().toTimeString().slice(0, 5),
          phone: "",
          email: "",
          company: "",
          department: "",
          location: "",
          unit: "",
          area: "",
          access_needed: "",
          preferred_entry_time: "",
          priority: "normal",
          service_type: "maintenance",
          description: "",
          assigned_to: "",
          scheduled_date: "",
          scheduled_time: "",
          project_id: "",
        });
        fetchWorkOrders();
        fetchStats();
      }
    } catch (error) {
      console.error("Failed to create work order:", error);
    } finally {
      setCreating(false);
    }
  }

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
            <button
              onClick={() => setShowCreateModal(true)}
              className="tl-btn px-4 py-2.5 text-sm"
            >
              + New Work Order
            </button>
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

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-9999 p-0 md:p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="tl-card w-full max-w-2xl h-svh md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col rounded-none md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-3 pb-1 bg-white">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-(--border)">
              <h2 className="text-xl font-semibold text-(--text)">New Work Order</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-(--bg) rounded-full transition"
              >
                <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateWorkOrder} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-(--text) uppercase tracking-wide">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newWorkOrder.phone}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Email</label>
                    <input
                      type="email"
                      value={newWorkOrder.email}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Company</label>
                    <input
                      type="text"
                      value={newWorkOrder.company}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, company: e.target.value })}
                      placeholder="Company name"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Department</label>
                    <input
                      type="text"
                      value={newWorkOrder.department}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, department: e.target.value })}
                      placeholder="Department"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-(--text) uppercase tracking-wide">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Location</label>
                    <input
                      type="text"
                      value={newWorkOrder.location}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, location: e.target.value })}
                      placeholder="Building/Address"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Unit</label>
                    <input
                      type="text"
                      value={newWorkOrder.unit}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, unit: e.target.value })}
                      placeholder="Unit #"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Area</label>
                    <input
                      type="text"
                      value={newWorkOrder.area}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, area: e.target.value })}
                      placeholder="Area"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Access Needed</label>
                    <input
                      type="text"
                      value={newWorkOrder.access_needed}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, access_needed: e.target.value })}
                      placeholder="Key, Code, etc."
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Preferred Entry Time</label>
                    <input
                      type="text"
                      value={newWorkOrder.preferred_entry_time}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, preferred_entry_time: e.target.value })}
                      placeholder="9AM - 5PM"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
              </div>

              {/* Work Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-(--text) uppercase tracking-wide">Work Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Priority *</label>
                    <select
                      value={newWorkOrder.priority}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, priority: e.target.value as WorkOrder["priority"] })}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    >
                      <option value="emergency">Emergency</option>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Service Type *</label>
                    <select
                      value={newWorkOrder.service_type}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, service_type: e.target.value as WorkOrder["service_type"] })}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    >
                      {SERVICE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">Description *</label>
                  <textarea
                    value={newWorkOrder.description}
                    onChange={(e) => setNewWorkOrder({ ...newWorkOrder, description: e.target.value })}
                    required
                    rows={4}
                    placeholder="Describe the issue or work requested..."
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
              </div>

              {/* Assignment */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-(--text) uppercase tracking-wide">Assignment (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Assign To</label>
                    <select
                      value={newWorkOrder.assigned_to}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, assigned_to: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Link to Project</label>
                    <select
                      value={newWorkOrder.project_id}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, project_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    >
                      <option value="">No project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      value={newWorkOrder.scheduled_date}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, scheduled_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Scheduled Time</label>
                    <input
                      type="time"
                      value={newWorkOrder.scheduled_time}
                      onChange={(e) => setNewWorkOrder({ ...newWorkOrder, scheduled_time: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t border-(--border)">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
