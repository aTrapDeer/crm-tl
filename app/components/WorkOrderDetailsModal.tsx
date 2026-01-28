"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import SignatureCapture from "./SignatureCapture";

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
}

interface Invitation {
  id: string;
  work_order_id: string;
  customer_name: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  inviter_name?: string;
  created_at: string;
  accepted_at: string | null;
}

// interface Project {
//   id: string;
//   name: string;
// }

interface WorkOrderDetailsModalProps {
  workOrder: WorkOrder;
  onClose: () => void;
  userRole: "admin" | "employee";
  onWorkOrderUpdate?: (workOrder: WorkOrder) => void;
  onWorkOrderDelete?: (id: string) => void;
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

export default function WorkOrderDetailsModal({
  workOrder: initialWorkOrder,
  onClose,
  userRole,
  onWorkOrderUpdate,
  onWorkOrderDelete,
}: WorkOrderDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [workOrder, setWorkOrder] = useState(initialWorkOrder);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState<"tl_corp_rep" | "building_rep" | null>(null);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInviteCustomer, setShowInviteCustomer] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({
    time_in: workOrder.time_in || "",
    time_out: workOrder.time_out || "",
    work_summary: workOrder.work_summary || "",
    assigned_to: workOrder.assigned_to || "",
    scheduled_date: workOrder.scheduled_date || "",
    scheduled_time: workOrder.scheduled_time || "",
  });

  const [newMaterial, setNewMaterial] = useState({
    material_name: "",
    quantity: "1",
    unit: "",
    unit_cost: "",
    notes: "",
  });

  const [signatureForm, setSignatureForm] = useState({
    signer_name: "",
    signer_title: "",
  });

  const [inviteForm, setInviteForm] = useState({
    customer_name: "",
    email: "",
  });

  const [updating, setUpdating] = useState(false);

  // Portal mounting
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const canEdit = userRole === "admin" || workOrder.assigned_to !== null;
  const canDelete = userRole === "admin";

  const fetchData = useCallback(async () => {
    try {
      const [materialsRes, signaturesRes, invitationsRes, usersRes] = await Promise.all([
        fetch(`/api/work-orders/${workOrder.id}/materials`),
        fetch(`/api/work-orders/${workOrder.id}/signatures`),
        fetch(`/api/work-orders/${workOrder.id}/invitations`),
        fetch("/api/users"),
      ]);

      const materialsData = await materialsRes.json();
      const signaturesData = await signaturesRes.json();
      const invitationsData = await invitationsRes.json();
      const usersData = await usersRes.json();

      setMaterials(materialsData.materials || []);
      setSignatures(signaturesData.signatures || []);
      setInvitations(invitationsData.invitations || []);
      setUsers((usersData.users || []).filter((u: User) => u.role !== "client"));
    } catch (error) {
      console.error("Failed to fetch work order details:", error);
    } finally {
      setLoading(false);
    }
  }, [workOrder.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleStatusChange(newStatus: WorkOrder["work_completed"]) {
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

      const res = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        const data = await res.json();
        setWorkOrder(data.workOrder);
        onWorkOrderUpdate?.(data.workOrder);
        setShowStatusChange(false);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdateExecution(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);

    // Calculate labor hours if both times are set
    let totalLaborHours = null;
    if (editForm.time_in && editForm.time_out) {
      const timeIn = new Date(`2000-01-01T${editForm.time_in}`);
      const timeOut = new Date(`2000-01-01T${editForm.time_out}`);
      totalLaborHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
      if (totalLaborHours < 0) totalLaborHours += 24; // Handle overnight work
    }

    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          total_labor_hours: totalLaborHours,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setWorkOrder(data.workOrder);
        onWorkOrderUpdate?.(data.workOrder);
        setShowEditModal(false);
      }
    } catch (error) {
      console.error("Failed to update work order:", error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!newMaterial.material_name.trim()) return;

    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/materials`, {
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
        fetchData();
      }
    } catch (error) {
      console.error("Failed to add material:", error);
    }
  }

  async function handleDeleteMaterial(materialId: string) {
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/materials`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material_id: materialId }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete material:", error);
    }
  }

  async function handleSaveSignature(signatureData: string) {
    if (!showSignatureCapture || !signatureForm.signer_name.trim()) return;

    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/signatures`, {
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
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save signature:", error);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onWorkOrderDelete?.(workOrder.id);
        onClose();
      }
    } catch (error) {
      console.error("Failed to delete work order:", error);
    }
  }

  async function handleInviteCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.customer_name.trim() || !inviteForm.email.trim()) return;

    setInviteLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: inviteForm.customer_name.trim(),
          email: inviteForm.email.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInvitations((prev) => [data.invitation, ...prev]);
        setInviteForm({ customer_name: "", email: "" });
        setShowInviteCustomer(false);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to send invitation");
      }
    } catch (error) {
      console.error("Failed to invite customer:", error);
      alert("Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  }

  const totalMaterialsCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const tlCorpSignature = signatures.find((s) => s.signer_type === "tl_corp_rep");
  const buildingRepSignature = signatures.find((s) => s.signer_type === "building_rep");

  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-9999 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="tl-card w-full max-w-4xl h-svh md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col rounded-none md:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 bg-white">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between p-4 md:p-6 border-b border-(--border)">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold text-(--text)">
                {workOrder.work_order_number}
              </h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PRIORITY_COLORS[workOrder.priority]}`}>
                {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[workOrder.work_completed]}`}>
                {workOrder.work_completed.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            </div>
            <p className="text-sm text-(--text)/70 mt-1">
              {workOrder.company || "No company"} {workOrder.department ? `- ${workOrder.department}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {canEdit && (
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 hover:bg-(--bg) rounded-full transition"
                title="Edit work order"
              >
                <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <Link
              href={`/dashboard/management/work-orders/${workOrder.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-(--bg) rounded-full transition"
              title="Open in new tab"
            >
              <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
            {canDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 hover:bg-red-50 rounded-full transition"
                title="Delete work order"
              >
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-(--bg) rounded-full transition"
              title="Close"
            >
              <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text)"></div>
            </div>
          ) : (
            <>
              {/* Status Actions */}
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowStatusChange(true)}
                    className="tl-btn-outline px-4 py-2 text-sm"
                  >
                    Change Status
                  </button>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="tl-btn-outline px-4 py-2 text-sm"
                  >
                    Edit Execution Details
                  </button>
                </div>
              )}

              {/* Work Details Section */}
              <div className="tl-card p-4 space-y-4">
                <h3 className="font-semibold text-(--text)">Work Details</h3>
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
                      {workOrder.time_received || "—"}
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

              {/* Contact Info Section */}
              <div className="tl-card p-4 space-y-4">
                <h3 className="font-semibold text-(--text)">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Phone</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.email || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Customer Contacts Section */}
              <div className="tl-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-(--text)">Customer Contacts</h3>
                  {canEdit && (
                    <button
                      onClick={() => setShowInviteCustomer(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Customer
                    </button>
                  )}
                </div>
                {invitations.length === 0 ? (
                  <p className="text-sm text-(--text)/60">No customer contacts added</p>
                ) : (
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-(--bg)"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-(--text)">{inv.customer_name}</p>
                          <p className="text-xs text-(--text)/60 truncate">{inv.email}</p>
                          {inv.inviter_name && (
                            <p className="text-xs text-(--text)/40 mt-1">Added by {inv.inviter_name}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                            inv.status === "accepted"
                              ? "bg-green-100 text-green-700"
                              : inv.status === "expired"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Location Section */}
              <div className="tl-card p-4 space-y-4">
                <h3 className="font-semibold text-(--text)">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Location</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.location || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Unit</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.unit || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Area</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.area || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Access Needed</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.access_needed || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Preferred Entry Time</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.preferred_entry_time || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Execution Section */}
              <div className="tl-card p-4 space-y-4">
                <h3 className="font-semibold text-(--text)">Execution</h3>
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
                      {workOrder.time_in || "—"} / {workOrder.time_out || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Total Labor Hours</p>
                    <p className="text-sm font-medium text-(--text) mt-1">
                      {workOrder.total_labor_hours?.toFixed(2) || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Materials Section */}
              <div className="tl-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-(--text)">Materials & Parts</h3>
                  {canEdit && (
                    <button
                      onClick={() => setShowAddMaterial(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Material
                    </button>
                  )}
                </div>
                {materials.length === 0 ? (
                  <p className="text-sm text-(--text)/60">No materials recorded</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {materials.map((material) => (
                        <div
                          key={material.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-(--bg)"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-(--text)">{material.material_name}</p>
                            <p className="text-xs text-(--text)/60">
                              Qty: {material.quantity} {material.unit || ""}
                              {material.unit_cost && ` @ $${material.unit_cost.toFixed(2)}`}
                            </p>
                            {material.notes && (
                              <p className="text-xs text-(--text)/60 mt-1">{material.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {material.total_cost && (
                              <span className="text-sm font-medium text-(--text)">
                                ${material.total_cost.toFixed(2)}
                              </span>
                            )}
                            {canEdit && (
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

              {/* Completion Section */}
              <div className="tl-card p-4 space-y-4">
                <h3 className="font-semibold text-(--text)">Completion & Close Out</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Completed Date/Time</p>
                    <p className="text-sm font-medium text-(--text) mt-1">
                      {workOrder.completed_date
                        ? `${new Date(workOrder.completed_date).toLocaleDateString()} ${workOrder.completed_time || ""}`
                        : "Not completed"}
                    </p>
                  </div>
                </div>
                {workOrder.work_summary && (
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Summary of Work Performed</p>
                    <p className="text-sm text-(--text) mt-1 whitespace-pre-wrap">{workOrder.work_summary}</p>
                  </div>
                )}
              </div>

              {/* Signatures Section */}
              <div className="tl-card p-4 space-y-4">
                <h3 className="font-semibold text-(--text)">Signatures</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* TL Corp Rep Signature */}
                  <div className="space-y-2">
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">TL Corp Representative</p>
                    {tlCorpSignature ? (
                      <div className="border border-(--border) rounded-lg p-3">
                        <Image
                          src={tlCorpSignature.signature_data}
                          alt="TL Corp Rep Signature"
                          width={200}
                          height={64}
                          className="h-16 w-auto object-contain"
                          unoptimized
                        />
                        <p className="text-sm font-medium text-(--text) mt-2">{tlCorpSignature.signer_name}</p>
                        {tlCorpSignature.signer_title && (
                          <p className="text-xs text-(--text)/60">{tlCorpSignature.signer_title}</p>
                        )}
                        <p className="text-xs text-(--text)/60">
                          {new Date(tlCorpSignature.signed_date).toLocaleDateString()}
                        </p>
                      </div>
                    ) : canEdit ? (
                      <button
                        onClick={() => setShowSignatureCapture("tl_corp_rep")}
                        className="w-full border-2 border-dashed border-(--border) rounded-lg p-4 text-sm text-(--text)/60 hover:border-(--ring) hover:text-(--text) transition"
                      >
                        Click to capture signature
                      </button>
                    ) : (
                      <p className="text-sm text-(--text)/60">No signature</p>
                    )}
                  </div>

                  {/* Building Rep Signature */}
                  <div className="space-y-2">
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Building Representative</p>
                    {buildingRepSignature ? (
                      <div className="border border-(--border) rounded-lg p-3">
                        <Image
                          src={buildingRepSignature.signature_data}
                          alt="Building Rep Signature"
                          width={200}
                          height={64}
                          className="h-16 w-auto object-contain"
                          unoptimized
                        />
                        <p className="text-sm font-medium text-(--text) mt-2">{buildingRepSignature.signer_name}</p>
                        {buildingRepSignature.signer_title && (
                          <p className="text-xs text-(--text)/60">{buildingRepSignature.signer_title}</p>
                        )}
                        <p className="text-xs text-(--text)/60">
                          {new Date(buildingRepSignature.signed_date).toLocaleDateString()}
                        </p>
                      </div>
                    ) : canEdit ? (
                      <button
                        onClick={() => setShowSignatureCapture("building_rep")}
                        className="w-full border-2 border-dashed border-(--border) rounded-lg p-4 text-sm text-(--text)/60 hover:border-(--ring) hover:text-(--text) transition"
                      >
                        Click to capture signature
                      </button>
                    ) : (
                      <p className="text-sm text-(--text)/60">No signature</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="text-xs text-(--text)/50 space-y-1">
                <p>Created: {new Date(workOrder.created_at).toLocaleString()} {workOrder.creator_name ? `by ${workOrder.creator_name}` : ""}</p>
                <p>Last Updated: {new Date(workOrder.updated_at).toLocaleString()}</p>
              </div>
            </>
          )}
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

      {/* Edit Execution Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4" onClick={() => setShowEditModal(false)}>
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-4">Edit Execution Details</h3>
            <form onSubmit={handleUpdateExecution} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Assigned To</label>
                <select
                  value={editForm.assigned_to}
                  onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Work Summary</label>
                <textarea
                  value={editForm.work_summary}
                  onChange={(e) => setEditForm({ ...editForm, work_summary: e.target.value })}
                  rows={4}
                  placeholder="Summary of work performed..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4" onClick={() => setShowAddMaterial(false)}>
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Notes</label>
                <input
                  type="text"
                  value={newMaterial.notes}
                  onChange={(e) => setNewMaterial({ ...newMaterial, notes: e.target.value })}
                  placeholder="Optional notes"
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
                <button
                  type="submit"
                  className="flex-1 tl-btn px-4 py-2.5 text-sm"
                >
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
                  onClick={() => {
                    if (signatureForm.signer_name.trim()) {
                      // Name is set, signature capture component will show
                    }
                  }}
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

      {/* Invite Customer Modal */}
      {showInviteCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4" onClick={() => setShowInviteCustomer(false)}>
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-4">Add Customer Contact</h3>
            <p className="text-sm text-(--text)/70 mb-4">
              Add a customer contact to receive updates about this work order.
            </p>
            <form onSubmit={handleInviteCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={inviteForm.customer_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, customer_name: e.target.value })}
                  required
                  placeholder="Full name"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Email Address *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                  placeholder="customer@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteCustomer(false);
                    setInviteForm({ customer_name: "", email: "" });
                  }}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {inviteLoading ? "Sending..." : "Add & Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10000 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="tl-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-2">Delete Work Order</h3>
            <p className="text-sm text-(--text)/70 mb-4">
              Are you sure you want to delete work order <strong>{workOrder.work_order_number}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-full bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
