"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const [userRole, setUserRole] = useState<"admin" | "worker" | null>(null);

  // Modal states
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState<"tl_corp_rep" | "building_rep" | null>(null);
  const [signatureForm, setSignatureForm] = useState({ signer_name: "", signer_title: "" });

  // Form states
  const [newMaterial, setNewMaterial] = useState({
    material_name: "",
    quantity: "1",
    unit: "",
    unit_cost: "",
    notes: "",
  });

  const [updating, setUpdating] = useState(false);

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
          <button
            onClick={() => setShowStatusChange(true)}
            className="tl-btn px-4 py-2 text-sm"
          >
            Change Status
          </button>
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
                  <img src={tlCorpSignature.signature_data} alt="TL Corp Rep Signature" className="h-16 object-contain" />
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
                  <img src={buildingRepSignature.signature_data} alt="Building Rep Signature" className="h-16 object-contain" />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" onClick={() => setShowStatusChange(false)}>
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

      {/* Add Material Modal */}
      {showAddMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" onClick={() => setShowAddMaterial(false)}>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" onClick={() => setShowSignatureCapture(null)}>
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
