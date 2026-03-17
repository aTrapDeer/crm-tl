"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatUsCentralDateTime } from "@/lib/us-central-time";

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
  status_note: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
  status_updated_by_name?: string;
  project_id: string | null;
  project_name?: string;
  publication_status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
}

interface EditFormState {
  phone: string;
  email: string;
  company: string;
  department: string;
  location: string;
  unit: string;
  area: string;
  access_needed: string;
  preferred_entry_time: string;
  priority: WorkOrder["priority"];
  service_type: WorkOrder["service_type"];
  description: string;
  assigned_to: string;
  scheduled_date: string;
  scheduled_time: string;
  time_in: string;
  time_out: string;
  total_labor_hours: string;
  work_completed: WorkOrder["work_completed"];
  completed_date: string;
  completed_time: string;
  work_summary: string;
  status_note: string;
  project_id: string;
  date: string;
  time_received: string;
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

function getInitialFormState(workOrder: WorkOrder): EditFormState {
  return {
    phone: workOrder.phone || "",
    email: workOrder.email || "",
    company: workOrder.company || "",
    department: workOrder.department || "",
    location: workOrder.location || "",
    unit: workOrder.unit || "",
    area: workOrder.area || "",
    access_needed: workOrder.access_needed || "",
    preferred_entry_time: workOrder.preferred_entry_time || "",
    priority: workOrder.priority,
    service_type: workOrder.service_type,
    description: workOrder.description || "",
    assigned_to: workOrder.assigned_to || "",
    scheduled_date: workOrder.scheduled_date || "",
    scheduled_time: workOrder.scheduled_time || "",
    time_in: workOrder.time_in || "",
    time_out: workOrder.time_out || "",
    total_labor_hours: workOrder.total_labor_hours?.toString() || "",
    work_completed: workOrder.work_completed,
    completed_date: workOrder.completed_date || "",
    completed_time: workOrder.completed_time || "",
    work_summary: workOrder.work_summary || "",
    status_note: workOrder.status_note || "",
    project_id: workOrder.project_id || "",
    date: workOrder.date || "",
    time_received: workOrder.time_received || "",
  };
}

function formatSavedTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EditWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<EditFormState | null>(null);

  useEffect(() => {
    let cancelled = false;

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

        const role = sessionData.user.role as "admin" | "employee";
        if (cancelled) return;
        setUserRole(role);

        const workOrderRes = await fetch(`/api/work-orders/${id}`);
        const workOrderData = await workOrderRes.json().catch(() => ({}));
        if (!workOrderRes.ok || !workOrderData.workOrder) {
          if (!cancelled) {
            setError(workOrderData.error || "Failed to load work order.");
          }
          return;
        }

        if (cancelled) return;
        setWorkOrder(workOrderData.workOrder as WorkOrder);
        setForm(getInitialFormState(workOrderData.workOrder as WorkOrder));

        if (role === "admin") {
          const [usersRes, projectsRes] = await Promise.all([
            fetch("/api/users"),
            fetch("/api/projects"),
          ]);
          const usersData = await usersRes.json().catch(() => ({}));
          const projectsData = await projectsRes.json().catch(() => ({}));

          if (!cancelled) {
            setUsers((usersData.users || []).filter((u: User) => u.role !== "client"));
            setProjects(projectsData.projects || []);
          }
        }
      } catch (initError) {
        console.error("Failed to initialize edit page:", initError);
        if (!cancelled) {
          setError("Failed to load work order.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const isAdmin = userRole === "admin";
  const isPublished = workOrder?.publication_status === "published";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !workOrder || !userRole) return;

    setError("");
    setSaveMessage("");

    if (userRole === "admin" && !form.description.trim()) {
      setError("Description is required.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string | number | null> =
        isPublished
          ? {
              work_completed: form.work_completed,
              completed_date: form.completed_date || null,
              completed_time: form.completed_time || null,
              ...(isAdmin ? { status_note: form.status_note || null } : {}),
            }
          : userRole === "admin"
          ? {
              date: form.date || null,
              time_received: form.time_received || null,
              phone: form.phone || null,
              email: form.email || null,
              company: form.company || null,
              department: form.department || null,
              location: form.location || null,
              unit: form.unit || null,
              area: form.area || null,
              access_needed: form.access_needed || null,
              preferred_entry_time: form.preferred_entry_time || null,
              priority: form.priority,
              service_type: form.service_type,
              description: form.description,
              assigned_to: form.assigned_to || null,
              project_id: form.project_id || null,
              scheduled_date: form.scheduled_date || null,
              scheduled_time: form.scheduled_time || null,
              time_in: form.time_in || null,
              time_out: form.time_out || null,
              total_labor_hours: form.total_labor_hours ? parseFloat(form.total_labor_hours) : null,
              work_completed: form.work_completed,
              completed_date: form.completed_date || null,
              completed_time: form.completed_time || null,
              work_summary: form.work_summary || null,
              status_note: form.status_note || null,
            }
          : {
              scheduled_date: form.scheduled_date || null,
              scheduled_time: form.scheduled_time || null,
              time_in: form.time_in || null,
              time_out: form.time_out || null,
              total_labor_hours: form.total_labor_hours ? parseFloat(form.total_labor_hours) : null,
              work_completed: form.work_completed,
              completed_date: form.completed_date || null,
              completed_time: form.completed_time || null,
              work_summary: form.work_summary || null,
            };

      const res = await fetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update work order.");
        return;
      }

      const updatedWorkOrder = data.workOrder as WorkOrder;
      setWorkOrder(updatedWorkOrder);
      setForm(getInitialFormState(updatedWorkOrder));
      if (updatedWorkOrder.publication_status === "draft") {
        setSaveMessage(`Draft saved at ${formatSavedTime(new Date())}`);
      }
    } catch (submitError) {
      console.error("Failed to update work order:", submitError);
      setError("Failed to update work order.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!workOrder || publishing || isPublished) return;

    setPublishing(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await fetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publication_status: "published" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to publish work order.");
        return;
      }

      const updatedWorkOrder = data.workOrder as WorkOrder;
      setWorkOrder(updatedWorkOrder);
      setForm(getInitialFormState(updatedWorkOrder));
      setSaveMessage("Work order published. Editing is now locked.");
    } catch (publishError) {
      console.error("Failed to publish work order:", publishError);
      setError("Failed to publish work order.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  if (!workOrder || !form || !userRole) {
    return (
      <div className="min-h-screen bg-(--bg)">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <Link
            href="/dashboard/management"
            className="inline-flex items-center gap-2 text-sm text-(--text)/70 hover:text-(--text)"
          >
            <span aria-hidden>{"<"}</span>
            Back to Management
          </Link>
          <div className="tl-card p-6">
            <h1 className="text-lg font-semibold text-(--text)">Unable to load work order</h1>
            <p className="text-sm text-red-700 mt-2">{error || "Please try again."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <Link
              href={`/dashboard/management/work-orders/${id}`}
              className="inline-flex items-center gap-2 text-sm text-(--text)/70 hover:text-(--text)"
            >
              <span aria-hidden>{"<"}</span>
              Back to Work Order
            </Link>
            <h1 className="text-2xl font-bold text-(--text)">Edit Work Order</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-(--text)/60">{workOrder.work_order_number}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  workOrder.publication_status === "published"
                    ? "bg-slate-800 text-white"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {workOrder.publication_status}
              </span>
              {workOrder.published_at && (
                <span className="text-xs text-(--text)/50">
                  Published {new Date(workOrder.published_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {saveMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            {saveMessage}
          </div>
        )}

        {isPublished && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm">
            This work order is published. General edits are locked, but status and close-out updates can still be saved here.
          </div>
        )}

        {!isAdmin && (
          <div className="tl-card p-5 space-y-2">
            <p className="text-xs uppercase tracking-wide text-(--text)/60">Work Order</p>
            <p className="text-sm font-semibold text-(--text)">{workOrder.work_order_number}</p>
            <p className="text-sm text-(--text)/70 whitespace-pre-wrap">{workOrder.description}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isPublished ? (
            <div className="tl-card p-5 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Status & Close-Out</h2>
              <div className="rounded-xl border border-(--border)/20 bg-(--bg) px-4 py-3 text-sm text-(--text)/75">
                <p className="font-semibold text-(--text)">Close-Out Audit</p>
                <p className="mt-1">
                  Last status update:{" "}
                  {workOrder.status_updated_at
                    ? `${formatUsCentralDateTime(workOrder.status_updated_at)} CT${workOrder.status_updated_by_name ? ` by ${workOrder.status_updated_by_name}` : ""}`
                    : "No status updates recorded yet."}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={form.work_completed} onChange={(event) => setForm({ ...form, work_completed: event.target.value as WorkOrder["work_completed"] })} className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input type="date" value={form.completed_date} onChange={(event) => setForm({ ...form, completed_date: event.target.value })} placeholder="Completed Date" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                <input type="time" value={form.completed_time} onChange={(event) => setForm({ ...form, completed_time: event.target.value })} placeholder="Completed Time" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
              </div>
              {isAdmin && (
                <textarea value={form.status_note} onChange={(event) => setForm({ ...form, status_note: event.target.value })} rows={3} placeholder="Admin close-out note" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
              )}
            </div>
          ) : (
          <fieldset className="space-y-6">
            {isAdmin && (
              <div className="tl-card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-(--text)">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                  <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                  <input type="text" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                  <input type="text" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Department" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="tl-card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-(--text)">Location</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="text" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location / Building" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                  <input type="text" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="Unit" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                  <input type="text" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} placeholder="Area" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" value={form.access_needed} onChange={(event) => setForm({ ...form, access_needed: event.target.value })} placeholder="Access Needed" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                  <input type="text" value={form.preferred_entry_time} onChange={(event) => setForm({ ...form, preferred_entry_time: event.target.value })} placeholder="Preferred Entry Time" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="tl-card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-(--text)">Work Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as WorkOrder["priority"] })} className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)">
                    <option value="emergency">Emergency</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={form.service_type} onChange={(event) => setForm({ ...form, service_type: event.target.value as WorkOrder["service_type"] })} className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)">
                    {SERVICE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                  <input type="text" value={form.time_received} onChange={(event) => setForm({ ...form, time_received: event.target.value })} placeholder="Time Received" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                </div>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={5} required className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
              </div>
            )}

            <div className="tl-card p-5 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Assignment & Execution</h2>
              <div className="rounded-xl border border-(--border)/20 bg-(--bg) px-4 py-3 text-sm text-(--text)/75">
                <p className="font-semibold text-(--text)">Close-Out Audit</p>
                <p className="mt-1">
                  Last status update:{" "}
                  {workOrder.status_updated_at
                    ? `${formatUsCentralDateTime(workOrder.status_updated_at)} CT${workOrder.status_updated_by_name ? ` by ${workOrder.status_updated_by_name}` : ""}`
                    : "No status updates recorded yet."}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isAdmin && (
                  <select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)">
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.role})
                      </option>
                    ))}
                  </select>
                )}
                {isAdmin && (
                  <select value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)">
                    <option value="">No Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
                <input type="date" value={form.scheduled_date} onChange={(event) => setForm({ ...form, scheduled_date: event.target.value })} placeholder="Scheduled Date" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                <input type="time" value={form.scheduled_time} onChange={(event) => setForm({ ...form, scheduled_time: event.target.value })} placeholder="Scheduled Time" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                <input type="time" value={form.time_in} onChange={(event) => setForm({ ...form, time_in: event.target.value })} placeholder="Time In" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                <input type="time" value={form.time_out} onChange={(event) => setForm({ ...form, time_out: event.target.value })} placeholder="Time Out" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                <input type="number" step="0.01" min="0" value={form.total_labor_hours} onChange={(event) => setForm({ ...form, total_labor_hours: event.target.value })} placeholder="Total Labor Hours" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                <select value={form.work_completed} onChange={(event) => setForm({ ...form, work_completed: event.target.value as WorkOrder["work_completed"] })} className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input type="date" value={form.completed_date} onChange={(event) => setForm({ ...form, completed_date: event.target.value })} placeholder="Completed Date" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
                <input type="time" value={form.completed_time} onChange={(event) => setForm({ ...form, completed_time: event.target.value })} placeholder="Completed Time" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
              </div>
              <textarea value={form.work_summary} onChange={(event) => setForm({ ...form, work_summary: event.target.value })} rows={4} placeholder="Work Summary" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
              {isAdmin && (
                <textarea value={form.status_note} onChange={(event) => setForm({ ...form, status_note: event.target.value })} rows={3} placeholder="Admin close-out note" className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)" />
              )}
            </div>
          </fieldset>
          )}

          <div className="sticky bottom-0 bg-(--bg)/95 backdrop-blur border-t border-(--border) pt-4 pb-2">
            <div className="flex gap-3">
              <Link
                href={`/dashboard/management/work-orders/${id}`}
                className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-center text-sm font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Back
              </Link>
              {!isPublished && (
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishing || saving}
                  className="flex-1 rounded-full border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 transition disabled:opacity-60"
                >
                  {publishing ? "Publishing..." : "Publish Work Order"}
                </button>
              )}
              <button
                type="submit"
                disabled={saving || publishing}
                className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : isPublished ? "Save Status Update" : "Save Draft Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
