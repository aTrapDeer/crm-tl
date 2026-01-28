"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import SignatureCapture from "@/app/components/SignatureCapture";

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

interface Material {
  id: string;
  work_order_id: string;
  material_name: string;
  quantity: number;
  unit: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  created_at: string;
}

interface Signature {
  id: string;
  work_order_id: string;
  signer_type: "tl_corp_rep" | "building_rep";
  signer_name: string;
  signer_title: string | null;
  signature_data: string;
  signed_date: string;
  signed_at: string;
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

const PRIORITY_COLORS = {
  emergency: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const SERVICE_TYPES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "replace", label: "Replace" },
  { value: "inspection", label: "Inspection" },
  { value: "preventive", label: "Preventive" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
];

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Modal states
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState<"tl_corp_rep" | "building_rep" | null>(null);
  const [signatureForm, setSignatureForm] = useState({ signer_name: "", signer_title: "" });
  const [showEditWorkOrder, setShowEditWorkOrder] = useState(false);

  // Form states
  const [newMaterial, setNewMaterial] = useState({
    material_name: "",
    quantity: "1",
    unit: "",
    unit_cost: "",
    notes: "",
  });

  const [updating, setUpdating] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
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
    time_in: "",
    time_out: "",
    total_labor_hours: "",
    work_completed: "pending" as WorkOrder["work_completed"],
    completed_date: "",
    completed_time: "",
    work_summary: "",
    project_id: "",
    date: "",
    time_received: "",
  });

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();

        if (!data.user) {
          router.push("/login");
          return;
        }

        if (data.user.role === "client") {
          router.push("/dashboard");
          return;
        }

        setUserRole(data.user.role);
      } catch {
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!workOrder) return;
    setEditForm({
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
      project_id: workOrder.project_id || "",
      date: workOrder.date || "",
      time_received: workOrder.time_received || "",
    });
  }, [workOrder]);

  useEffect(() => {
    if (userRole !== "admin") return;
    async function fetchAdminData() {
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
        console.error("Failed to load users or projects:", error);
      }
    }
    fetchAdminData();
  }, [userRole]);

  const fetchWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`);
      if (!res.ok) {
        router.push("/dashboard/management");
        return;
      }
      const data = await res.json();
      setWorkOrder(data.workOrder);
    } catch (error) {
      console.error("Failed to fetch work order:", error);
      router.push("/dashboard/management");
    }
  }, [id, router]);

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}/materials`);
      const data = await res.json();
      setMaterials(data.materials || []);
    } catch (error) {
      console.error("Failed to fetch materials:", error);
    }
  }, [id]);

  const fetchSignatures = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}/signatures`);
      const data = await res.json();
      setSignatures(data.signatures || []);
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
    }
  }, [id]);

  useEffect(() => {
    if (userRole) {
      Promise.all([fetchWorkOrder(), fetchMaterials(), fetchSignatures()]).finally(() => {
        setLoading(false);
      });
    }
  }, [userRole, fetchWorkOrder, fetchMaterials, fetchSignatures]);

  async function handleStatusChange(newStatus: WorkOrder["work_completed"]) {
    if (!workOrder) return;
    setUpdating(true);

    try {
      const updateData: Record<string, string | null> = { work_completed: newStatus };

      if (newStatus === "completed") {
        const now = new Date();
        updateData.completed_date = now.toISOString().slice(0, 10);
        updateData.completed_time = now.toTimeString().slice(0, 5);
      } else {
        updateData.completed_date = null;
        updateData.completed_time = null;
      }

      const res = await fetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const data = await res.json();
        setWorkOrder(data.workOrder);
        setShowStatusChange(false);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!newMaterial.material_name.trim()) return;

    try {
      const res = await fetch(`/api/work-orders/${id}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_name: newMaterial.material_name,
          quantity: parseFloat(newMaterial.quantity) || 1,
          unit: newMaterial.unit || null,
          unit_cost: newMaterial.unit_cost ? parseFloat(newMaterial.unit_cost) : null,
          notes: newMaterial.notes || null,
        }),
      });

      if (res.ok) {
        setNewMaterial({ material_name: "", quantity: "1", unit: "", unit_cost: "", notes: "" });
        setShowAddMaterial(false);
        fetchMaterials();
      }
    } catch (error) {
      console.error("Failed to add material:", error);
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    try {
      const res = await fetch(`/api/work-orders/${id}/materials`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material_id: materialId }),
      });

      if (res.ok) {
        fetchMaterials();
      }
    } catch (error) {
      console.error("Failed to delete material:", error);
    }
  }

  async function handleUpdateWorkOrder(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");

    if (!editForm.description.trim()) {
      setEditError("Description is required.");
      return;
    }

    setSavingEdits(true);
    try {
      const payload: Record<string, string | number | null> = {
        phone: editForm.phone || null,
        email: editForm.email || null,
        company: editForm.company || null,
        department: editForm.department || null,
        location: editForm.location || null,
        unit: editForm.unit || null,
        area: editForm.area || null,
        access_needed: editForm.access_needed || null,
        preferred_entry_time: editForm.preferred_entry_time || null,
        priority: editForm.priority,
        service_type: editForm.service_type,
        description: editForm.description,
        assigned_to: editForm.assigned_to || null,
        scheduled_date: editForm.scheduled_date || null,
        scheduled_time: editForm.scheduled_time || null,
        time_in: editForm.time_in || null,
        time_out: editForm.time_out || null,
        total_labor_hours: editForm.total_labor_hours ? parseFloat(editForm.total_labor_hours) : null,
        work_completed: editForm.work_completed,
        completed_date: editForm.completed_date || null,
        completed_time: editForm.completed_time || null,
        work_summary: editForm.work_summary || null,
        project_id: editForm.project_id || null,
        date: editForm.date || null,
        time_received: editForm.time_received || null,
      };

      if (editForm.work_completed === "completed" && !editForm.completed_date) {
        const now = new Date();
        payload.completed_date = now.toISOString().slice(0, 10);
        payload.completed_time = now.toTimeString().slice(0, 5);
      }

      const res = await fetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update work order.");
        return;
      }

      setWorkOrder(data.workOrder);
      setShowEditWorkOrder(false);
    } catch (error) {
      console.error("Failed to update work order:", error);
      setEditError("Failed to update work order.");
    } finally {
      setSavingEdits(false);
    }
  }

  async function handleSaveSignature(signatureData: string) {
    if (!showSignatureCapture || !signatureForm.signer_name.trim()) return;

    try {
      const res = await fetch(`/api/work-orders/${id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_type: showSignatureCapture,
          signer_name: signatureForm.signer_name,
          signer_title: signatureForm.signer_title || null,
          signature_data: signatureData,
        }),
      });

      if (res.ok) {
        setShowSignatureCapture(null);
        setSignatureForm({ signer_name: "", signer_title: "" });
        fetchSignatures();
      }
    } catch (error) {
      console.error("Failed to save signature:", error);
    }
  }

  const totalMaterialsCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const tlCorpSignature = signatures.find((s) => s.signer_type === "tl_corp_rep");
  const buildingRepSignature = signatures.find((s) => s.signer_type === "building_rep");

  if (loading || !workOrder) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/management"
              className="p-2 hover:bg-white/80 rounded-lg transition tl-card"
            >
              <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-(--text)">{workOrder.work_order_number}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PRIORITY_COLORS[workOrder.priority]}`}>
                  {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[workOrder.work_completed]}`}>
                  {workOrder.work_completed.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>
              <p className="text-sm text-(--text)/60 mt-1">
                {workOrder.company || "No company"} {workOrder.department ? `- ${workOrder.department}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {userRole === "admin" && (
              <button
                onClick={() => setShowEditWorkOrder(true)}
                className="tl-btn px-4 py-2 text-sm"
              >
                Edit Work Order
              </button>
            )}
            <button
              onClick={() => setShowStatusChange(true)}
              className="tl-btn px-4 py-2 text-sm"
            >
              Change Status
            </button>
          </div>
        </div>

        {/* Success Banner (shown after creation) */}
        <div className="tl-card p-4 bg-green-50 border border-green-200">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-green-800">Work Order Created Successfully</p>
              <p className="text-sm text-green-600">
                Work Order #{workOrder.work_order_number} has been created and is ready for processing.
              </p>
            </div>
          </div>
        </div>

        {/* Work Details */}
        <div className="tl-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-(--text)">Work Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Service Type</p>
              <p className="text-sm font-medium text-(--text) mt-1">
                {SERVICE_TYPES.find((t) => t.value === workOrder.service_type)?.label}
              </p>
            </div>
            <div>
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Date</p>
              <p className="text-sm font-medium text-(--text) mt-1">
                {new Date(workOrder.date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Time Received</p>
              <p className="text-sm font-medium text-(--text) mt-1">
                {workOrder.time_received || "-"}
              </p>
            </div>
            {workOrder.project_name && (
              <div>
                <p className="text-xs text-(--text)/60 uppercase tracking-wide">Linked Project</p>
                <p className="text-sm font-medium text-(--text) mt-1">{workOrder.project_name}</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-(--text)/60 uppercase tracking-wide">Description</p>
            <p className="text-sm text-(--text) mt-1 whitespace-pre-wrap">{workOrder.description}</p>
          </div>
        </div>

        {/* Contact & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="tl-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-(--text)">Contact Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-(--text)/60 uppercase tracking-wide">Phone</p>
                <p className="text-sm font-medium text-(--text) mt-1">{workOrder.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-(--text)/60 uppercase tracking-wide">Email</p>
                <p className="text-sm font-medium text-(--text) mt-1">{workOrder.email || "-"}</p>
              </div>
            </div>
          </div>

          <div className="tl-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-(--text)">Location</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-(--text)/60 uppercase tracking-wide">Location / Unit / Area</p>
                <p className="text-sm font-medium text-(--text) mt-1">
                  {[workOrder.location, workOrder.unit, workOrder.area].filter(Boolean).join(" * ") || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--text)/60 uppercase tracking-wide">Access Needed</p>
                <p className="text-sm font-medium text-(--text) mt-1">{workOrder.access_needed || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-(--text)/60 uppercase tracking-wide">Preferred Entry Time</p>
                <p className="text-sm font-medium text-(--text) mt-1">{workOrder.preferred_entry_time || "-"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Execution */}
        <div className="tl-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-(--text)">Execution</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Assigned To</p>
              <p className="text-sm font-medium text-(--text) mt-1">
                {workOrder.assigned_user_name || "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Scheduled</p>
              <p className="text-sm font-medium text-(--text) mt-1">
                {workOrder.scheduled_date
                  ? `${new Date(workOrder.scheduled_date).toLocaleDateString()} ${workOrder.scheduled_time || ""}`
                  : "Not scheduled"}
              </p>
            </div>
            <div>
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Time In / Out</p>
              <p className="text-sm font-medium text-(--text) mt-1">
                {workOrder.time_in || "-"} / {workOrder.time_out || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Total Labor Hours</p>
              <p className="text-sm font-medium text-(--text) mt-1">
                {workOrder.total_labor_hours?.toFixed(2) || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="tl-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-(--text)">Materials & Parts</h2>
            <button
              onClick={() => setShowAddMaterial(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Material
            </button>
          </div>
          {materials.length === 0 ? (
            <p className="text-sm text-(--text)/60">No materials recorded</p>
          ) : (
            <>
              <div className="space-y-2">
                {materials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-3 rounded-lg bg-(--bg)">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-(--text)">{material.material_name}</p>
                      <p className="text-xs text-(--text)/60">
                        Qty: {material.quantity} {material.unit || ""}
                        {material.unit_cost && ` @ $${material.unit_cost.toFixed(2)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {material.total_cost && (
                        <span className="text-sm font-medium text-(--text)">
                          ${material.total_cost.toFixed(2)}
                        </span>
                      )}
                      {userRole === "admin" && (
                        <button
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="text-red-400 hover:text-red-600 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2 border-t border-(--border)">
                <p className="text-sm font-semibold text-(--text)">
                  Total: ${totalMaterialsCost.toFixed(2)}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Signatures */}
        <div className="tl-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-(--text)">Signatures</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TL Corp Rep */}
            <div className="space-y-2">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">TL Corp Representative</p>
              {tlCorpSignature ? (
                <div className="border border-(--border) rounded-lg p-3">
                  <Image src={tlCorpSignature.signature_data} alt="TL Corp Rep Signature" width={200} height={64} className="h-16 w-auto object-contain" unoptimized />
                  <p className="text-sm font-medium text-(--text) mt-2">{tlCorpSignature.signer_name}</p>
                  {tlCorpSignature.signer_title && <p className="text-xs text-(--text)/60">{tlCorpSignature.signer_title}</p>}
                  <p className="text-xs text-(--text)/60">{new Date(tlCorpSignature.signed_date).toLocaleDateString()}</p>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignatureCapture("tl_corp_rep")}
                  className="w-full border-2 border-dashed border-(--border) rounded-lg p-4 text-sm text-(--text)/60 hover:border-(--ring) hover:text-(--text) transition"
                >
                  Click to capture signature
                </button>
              )}
            </div>

            {/* Building Rep */}
            <div className="space-y-2">
              <p className="text-xs text-(--text)/60 uppercase tracking-wide">Building Representative</p>
              {buildingRepSignature ? (
                <div className="border border-(--border) rounded-lg p-3">
                  <Image src={buildingRepSignature.signature_data} alt="Building Rep Signature" width={200} height={64} className="h-16 w-auto object-contain" unoptimized />
                  <p className="text-sm font-medium text-(--text) mt-2">{buildingRepSignature.signer_name}</p>
                  {buildingRepSignature.signer_title && <p className="text-xs text-(--text)/60">{buildingRepSignature.signer_title}</p>}
                  <p className="text-xs text-(--text)/60">{new Date(buildingRepSignature.signed_date).toLocaleDateString()}</p>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignatureCapture("building_rep")}
                  className="w-full border-2 border-dashed border-(--border) rounded-lg p-4 text-sm text-(--text)/60 hover:border-(--ring) hover:text-(--text) transition"
                >
                  Click to capture signature
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs text-(--text)/50 space-y-1">
          <p>Created: {new Date(workOrder.created_at).toLocaleString()} {workOrder.creator_name ? `by ${workOrder.creator_name}` : ""}</p>
          <p>Last Updated: {new Date(workOrder.updated_at).toLocaleString()}</p>
        </div>
      </div>

      {/* Status Change Modal */}
      {showStatusChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10000 p-4" onClick={() => setShowStatusChange(false)}>
          <div className="tl-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-4">Change Status</h3>
            <div className="space-y-2">
              {(["pending", "in_progress", "completed", "cancelled"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={updating || workOrder.work_completed === status}
                  className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition ${
                    workOrder.work_completed === status
                      ? "bg-(--bg) text-(--text)/50 cursor-not-allowed"
                      : "hover:bg-(--bg) text-(--text)"
                  }`}
                >
                  <span className={`inline-block w-3 h-3 rounded-full mr-3 ${STATUS_COLORS[status].replace("text-", "bg-").replace("-100", "-500").replace("-700", "-500")}`}></span>
                  {status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStatusChange(false)}
              className="w-full mt-4 px-4 py-2.5 rounded-full border border-(--border)/30 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Work Order Modal */}
      {showEditWorkOrder && userRole === "admin" && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4" onClick={() => setShowEditWorkOrder(false)}>
          <div className="tl-card p-4 md:p-6 w-full max-w-3xl rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-(--text)">Edit Work Order</h3>
              <button
                onClick={() => setShowEditWorkOrder(false)}
                className="p-1 rounded-lg hover:bg-(--bg)"
              >
                <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateWorkOrder} className="space-y-6">
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {editError}
                </div>
              )}

              <div className="tl-card p-4 space-y-4">
                <h4 className="text-sm font-semibold text-(--text)">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Company</label>
                    <input
                      type="text"
                      value={editForm.company}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Department</label>
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
              </div>

              <div className="tl-card p-4 space-y-4">
                <h4 className="text-sm font-semibold text-(--text)">Location</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Location / Building</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Unit</label>
                    <input
                      type="text"
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Area</label>
                    <input
                      type="text"
                      value={editForm.area}
                      onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Access Needed</label>
                    <input
                      type="text"
                      value={editForm.access_needed}
                      onChange={(e) => setEditForm({ ...editForm, access_needed: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Preferred Entry Time</label>
                    <input
                      type="text"
                      value={editForm.preferred_entry_time}
                      onChange={(e) => setEditForm({ ...editForm, preferred_entry_time: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
              </div>

              <div className="tl-card p-4 space-y-4">
                <h4 className="text-sm font-semibold text-(--text)">Work Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Priority *</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as WorkOrder["priority"] })}
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
                      value={editForm.service_type}
                      onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value as WorkOrder["service_type"] })}
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
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Date</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Time Received</label>
                    <input
                      type="text"
                      value={editForm.time_received}
                      onChange={(e) => setEditForm({ ...editForm, time_received: e.target.value })}
                      placeholder="e.g., 9:15 AM"
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">Description *</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    required
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
              </div>

              <div className="tl-card p-4 space-y-4">
                <h4 className="text-sm font-semibold text-(--text)">Assignment & Execution</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Assign To</label>
                    <select
                      value={editForm.assigned_to}
                      onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
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
                    <label className="block text-sm font-medium text-(--text) mb-1">Linked Project</label>
                    <select
                      value={editForm.project_id}
                      onChange={(e) => setEditForm({ ...editForm, project_id: e.target.value })}
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
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      value={editForm.scheduled_date}
                      onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Scheduled Time</label>
                    <input
                      type="time"
                      value={editForm.scheduled_time}
                      onChange={(e) => setEditForm({ ...editForm, scheduled_time: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Time In</label>
                    <input
                      type="time"
                      value={editForm.time_in}
                      onChange={(e) => setEditForm({ ...editForm, time_in: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Time Out</label>
                    <input
                      type="time"
                      value={editForm.time_out}
                      onChange={(e) => setEditForm({ ...editForm, time_out: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Total Labor Hours</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.total_labor_hours}
                      onChange={(e) => setEditForm({ ...editForm, total_labor_hours: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Status</label>
                    <select
                      value={editForm.work_completed}
                      onChange={(e) => setEditForm({ ...editForm, work_completed: e.target.value as WorkOrder["work_completed"] })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Completed Date</label>
                    <input
                      type="date"
                      value={editForm.completed_date}
                      onChange={(e) => setEditForm({ ...editForm, completed_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Completed Time</label>
                    <input
                      type="time"
                      value={editForm.completed_time}
                      onChange={(e) => setEditForm({ ...editForm, completed_time: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">Work Summary</label>
                  <textarea
                    value={editForm.work_summary}
                    onChange={(e) => setEditForm({ ...editForm, work_summary: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditWorkOrder(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdits}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {savingEdits ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10000 p-4" onClick={() => setShowAddMaterial(false)}>
          <div className="tl-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-4">Add Material</h3>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Material Name *</label>
                <input
                  type="text"
                  value={newMaterial.material_name}
                  onChange={(e) => setNewMaterial({ ...newMaterial, material_name: e.target.value })}
                  required
                  placeholder="e.g., PVC Pipe 2in"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newMaterial.quantity}
                    onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">Unit</label>
                  <input
                    type="text"
                    value={newMaterial.unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                    placeholder="ea, ft, gal"
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Unit Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMaterial.unit_cost}
                  onChange={(e) => setNewMaterial({ ...newMaterial, unit_cost: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMaterial(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 tl-btn px-4 py-2.5 text-sm">
                  Add Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signature Name Modal */}
      {showSignatureCapture && !signatureForm.signer_name && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10000 p-4" onClick={() => setShowSignatureCapture(null)}>
          <div className="tl-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              {showSignatureCapture === "tl_corp_rep" ? "TL Corp Representative" : "Building Representative"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Name *</label>
                <input
                  type="text"
                  value={signatureForm.signer_name}
                  onChange={(e) => setSignatureForm({ ...signatureForm, signer_name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={signatureForm.signer_title}
                  onChange={(e) => setSignatureForm({ ...signatureForm, signer_title: e.target.value })}
                  placeholder="Job title"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSignatureCapture(null);
                    setSignatureForm({ signer_name: "", signer_title: "" });
                  }}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {}}
                  disabled={!signatureForm.signer_name.trim()}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Capture */}
      {showSignatureCapture && signatureForm.signer_name && (
        <SignatureCapture
          signerType={showSignatureCapture}
          signerName={signatureForm.signer_name}
          signerTitle={signatureForm.signer_title}
          onSave={handleSaveSignature}
          onCancel={() => {
            setShowSignatureCapture(null);
            setSignatureForm({ signer_name: "", signer_title: "" });
          }}
        />
      )}
    </div>
  );
}
