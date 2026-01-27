"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

type Priority = "emergency" | "high" | "normal" | "low";
type ServiceType = "maintenance" | "repair" | "replace" | "inspection" | "preventive" | "cleaning" | "other";

const SERVICE_TYPES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "replace", label: "Replace" },
  { value: "inspection", label: "Inspection" },
  { value: "preventive", label: "Preventive" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
];

export default function NewWorkOrderPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    // Contact Information
    phone: "",
    email: "",
    company: "",
    department: "",
    // Location
    location: "",
    unit: "",
    area: "",
    access_needed: "",
    preferred_entry_time: "",
    // Work Details
    priority: "normal" as Priority,
    service_type: "maintenance" as ServiceType,
    description: "",
    // Assignment (Optional)
    assigned_to: "",
    scheduled_date: "",
    scheduled_time: "",
    project_id: "",
  });

  // Check auth and fetch data
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();

        if (!data.user) {
          router.push("/login");
          return;
        }

        // Only admin can access
        if (data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        // Fetch users and projects
        const [usersRes, projectsRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/projects"),
        ]);
        const usersData = await usersRes.json();
        const projectsData = await projectsRes.json();

        setUsers((usersData.users || []).filter((u: User) => u.role !== "client"));
        setProjects(projectsData.projects || []);
      } catch (err) {
        console.error("Failed to initialize:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          assigned_to: formData.assigned_to || null,
          project_id: formData.project_id || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create work order");
        return;
      }

      const data = await res.json();
      // Redirect to the new work order page
      router.push(`/dashboard/management/work-orders/${data.workOrder.id}`);
    } catch (err) {
      console.error("Failed to create work order:", err);
      setError("An error occurred while creating the work order");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/dashboard/management"
            className="p-2 hover:bg-(--bg) rounded-lg transition"
          >
            <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-(--text)">New Work Order</h1>
            <p className="text-sm text-(--text)/60">Fill in the details below to create a work order</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Contact Information */}
          <div className="tl-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-(--text)">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Company name"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Department"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="tl-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-(--text)">Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Location / Building</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Building or address"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="Unit #"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Area</label>
                <input
                  type="text"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
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
                  value={formData.access_needed}
                  onChange={(e) => setFormData({ ...formData, access_needed: e.target.value })}
                  placeholder="Key, code, permission, etc."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Preferred Entry Time</label>
                <input
                  type="text"
                  value={formData.preferred_entry_time}
                  onChange={(e) => setFormData({ ...formData, preferred_entry_time: e.target.value })}
                  placeholder="e.g., 9AM - 5PM"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
            </div>
          </div>

          {/* Work Details */}
          <div className="tl-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-(--text)">Work Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Priority *</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="emergency">🔴 Emergency</option>
                  <option value="high">🟠 High</option>
                  <option value="normal">🔵 Normal</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Service Type *</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value as ServiceType })}
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
              <label className="block text-sm font-medium text-(--text) mb-1">Description of Issue / Request *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={6}
                placeholder="Describe the issue or work requested in detail..."
                className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
              />
            </div>
          </div>

          {/* Internal Use - Assignment (Optional) */}
          <div className="tl-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-(--text)">Internal Use & Assignment</h2>
              <span className="text-xs text-(--text)/50">Optional</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Assign To</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="">Leave Unassigned</option>
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
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="">No Project</option>
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
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Scheduled Time</label>
                <input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <Link
              href="/dashboard/management"
              className="flex-1 text-center rounded-full border border-(--border)/30 px-6 py-3 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 tl-btn px-6 py-3 text-sm disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Work Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
