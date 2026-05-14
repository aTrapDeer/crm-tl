"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { buildTapSignatureImage, getTapSignedAtLabel } from "@/app/components/tap-signature";
import EntityPhotoManager from "@/app/components/EntityPhotoManager";
import MaterialPurchaseManager from "@/app/components/MaterialPurchaseManager";
import { ModalLayer } from "@/app/components/ModalLayer";
import { formatUsCentralDateTime, formatWallClockTime12Hour } from "@/lib/us-central-time";

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

function formatWorkOrderStatusLabel(status: WorkOrder["work_completed"]) {
  if (status === "pending") return "Approval Needed";
  return status.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Signer");
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Modal states
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showLegacyMaterials, setShowLegacyMaterials] = useState(false);
  const [showEditWorkOrder, setShowEditWorkOrder] = useState(false);
  const [showDeleteWorkOrderWarning, setShowDeleteWorkOrderWarning] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deletingWorkOrder, setDeletingWorkOrder] = useState(false);
  const [deleteWorkOrderError, setDeleteWorkOrderError] = useState("");
  const [publishingWorkOrder, setPublishingWorkOrder] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusChangeNote, setStatusChangeNote] = useState("");

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
  const [receiptMaterialsTotal, setReceiptMaterialsTotal] = useState(0);
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
    status_note: "",
    project_id: "",
    date: "",
    time_received: "",
  });

  const resetEditFormToWorkOrder = useCallback((wo: WorkOrder) => {
    setEditForm({
      phone: wo.phone || "",
      email: wo.email || "",
      company: wo.company || "",
      department: wo.department || "",
      location: wo.location || "",
      unit: wo.unit || "",
      area: wo.area || "",
      access_needed: wo.access_needed || "",
      preferred_entry_time: wo.preferred_entry_time || "",
      priority: wo.priority,
      service_type: wo.service_type,
      description: wo.description || "",
      assigned_to: wo.assigned_to || "",
      scheduled_date: wo.scheduled_date || "",
      scheduled_time: wo.scheduled_time || "",
      time_in: wo.time_in || "",
      time_out: wo.time_out || "",
      total_labor_hours: wo.total_labor_hours?.toString() || "",
      work_completed: wo.work_completed,
      completed_date: wo.completed_date || "",
      completed_time: wo.completed_time || "",
      work_summary: wo.work_summary || "",
      status_note: wo.status_note || "",
      project_id: wo.project_id || "",
      date: wo.date || "",
      time_received: wo.time_received || "",
    });
    setStatusChangeNote(wo.status_note || "");
  }, []);

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

        setCurrentUserId(data.user.id);
        setCurrentUserName(
          `${data.user.first_name || ""} ${data.user.last_name || ""}`.trim() || "Signer"
        );
        setUserRole(data.user.role);
      } catch {
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!workOrder || showEditWorkOrder) return;
    resetEditFormToWorkOrder(workOrder);
  }, [workOrder, showEditWorkOrder, resetEditFormToWorkOrder]);

  useEffect(() => {
    if (materials.length > 0) {
      setShowLegacyMaterials(true);
    }
  }, [materials.length]);

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

  const dashboardHref = userRole === "employee" ? "/dashboard/work-orders" : "/dashboard/management";

  const fetchWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`);
      if (!res.ok) {
        router.push(dashboardHref);
        return;
      }
      const data = await res.json();
      setWorkOrder(data.workOrder);
    } catch (error) {
      console.error("Failed to fetch work order:", error);
      router.push(dashboardHref);
    }
  }, [dashboardHref, id, router]);

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

  useEffect(() => {
    const workOrderId = workOrder?.id;
    const assignedTo = workOrder?.assigned_to;

    if (userRole !== "employee" || !currentUserId || !workOrderId) return;
    if (assignedTo === currentUserId) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/work-orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigned_to: currentUserId }),
        });
        const data = (await res.json().catch(() => ({}))) as { workOrder?: WorkOrder };
        if (!cancelled && res.ok && data.workOrder) {
          setWorkOrder(data.workOrder);
        }
      } catch {
        // ignore — user can still view; assign may retry on navigation
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userRole, currentUserId, workOrder, id]);

  async function handleStatusChange(newStatus: WorkOrder["work_completed"]) {
    if (!workOrder) return;
    setUpdating(true);
    setActionError("");

    try {
      const updateData: Record<string, string | null> = {
        work_completed: newStatus,
        ...(userRole === "admin" ? { status_note: statusChangeNote || null } : {}),
      };

      if (newStatus !== "completed") {
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
        setStatusChangeNote(data.workOrder?.status_note || "");
        setShowStatusChange(false);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(data.error || "Failed to update status.");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      setActionError("Failed to update status.");
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
      if (userRole === "admin") {
        payload.status_note = editForm.status_note || null;
      }
      if (userRole === "employee" && currentUserId) {
        payload.assigned_to = currentUserId;
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

  function enterInlineEdit() {
    if (!workOrder) return;
    resetEditFormToWorkOrder(workOrder);
    setEditError("");
    setShowEditWorkOrder(true);
  }

  function handleCancelInlineEdit() {
    if (workOrder) resetEditFormToWorkOrder(workOrder);
    setEditError("");
    setShowEditWorkOrder(false);
  }

  async function handleTapSignature(signerType: "tl_corp_rep" | "building_rep") {
    const signerTitle = userRole === "admin" ? "Admin" : userRole === "employee" ? "Employee" : "";
    const signedAtLabel = getTapSignedAtLabel();
    const signatureData = buildTapSignatureImage(currentUserName, signedAtLabel, signerTitle);
    if (!signatureData || !currentUserName.trim()) return;

    try {
      const res = await fetch(`/api/work-orders/${id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_type: signerType,
          signer_name: currentUserName,
          signer_title: signerTitle || null,
          signature_data: signatureData,
        }),
      });

      if (res.ok) {
        fetchSignatures();
      }
    } catch (error) {
      console.error("Failed to save signature:", error);
    }
  }

  async function handleDeleteWorkOrder() {
    if (!workOrder || userRole !== "admin" || deletingWorkOrder) return;

    if (deleteConfirmInput.trim() !== workOrder.work_order_number) {
      setDeleteWorkOrderError(`Type ${workOrder.work_order_number} to confirm deletion.`);
      return;
    }

    setDeletingWorkOrder(true);
    setDeleteWorkOrderError("");
    try {
      const res = await fetch(`/api/work-orders/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteWorkOrderError(data.error || "Failed to delete work order.");
        return;
      }
      router.push("/dashboard/management");
    } catch (error) {
      console.error("Failed to delete work order:", error);
      setDeleteWorkOrderError("Failed to delete work order.");
    } finally {
      setDeletingWorkOrder(false);
    }
  }

  async function handlePublishWorkOrder() {
    if (!workOrder || userRole !== "admin" || workOrder.publication_status === "published" || publishingWorkOrder) return;

    setPublishingWorkOrder(true);
    setPublishMessage("");
    setActionError("");
    try {
      const res = await fetch(`/api/work-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publication_status: "published" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Failed to publish work order.");
        return;
      }

      setWorkOrder(data.workOrder as WorkOrder);
      setPublishMessage("Work order published. Assigned employees and admins can keep updating it.");
      setShowStatusChange(false);
      setShowAddMaterial(false);
    } catch (error) {
      console.error("Failed to publish work order:", error);
      setActionError("Failed to publish work order.");
    } finally {
      setPublishingWorkOrder(false);
    }
  }

  const legacyMaterialsTotal = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const combinedMaterialsTotal = receiptMaterialsTotal + legacyMaterialsTotal;
  const tlCorpSignature = signatures.find((s) => s.signer_type === "tl_corp_rep");
  const buildingRepSignature = signatures.find((s) => s.signer_type === "building_rep");
  const isPublished = workOrder?.publication_status === "published";
  const canEditWorkOrder =
    !!workOrder && !!userRole && (userRole === "admin" || userRole === "employee");
  const canManagePhotos = !!canEditWorkOrder;
  const canChangeStatus = canEditWorkOrder;
  const canAddMaterial = canEditWorkOrder;
  const canCaptureSignature = canEditWorkOrder;
  const sharedEditRestrictionMessage = "Sign in as an employee or admin to make changes.";
  const materialActionTitle = canAddMaterial
    ? "Add a legacy material"
    : sharedEditRestrictionMessage;
  const signatureActionTitle = canCaptureSignature
    ? "Capture signature"
    : sharedEditRestrictionMessage;
  const photoLockedMessage = !canEditWorkOrder
    ? "Only employees and admins can add or remove photos."
    : "";
  const availableStatusOptions = (["pending", "in_progress", "completed", "cancelled"] as const).filter(
    (status) => userRole === "admin" || status !== "in_progress" || workOrder?.work_completed === "in_progress"
  );
  const inlineEditing = showEditWorkOrder;

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
              href={dashboardHref}
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
                  {formatWorkOrderStatusLabel(workOrder.work_completed)}
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium uppercase tracking-wide ${
                    isPublished ? "bg-slate-800 text-white" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {workOrder.publication_status}
                </span>
              </div>
              <p className="text-sm text-(--text)/60 mt-1">
                {workOrder.company || "No company"} {workOrder.department ? `- ${workOrder.department}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditWorkOrder && !inlineEditing && (
              <button type="button" onClick={enterInlineEdit} className="tl-btn px-4 py-2 text-sm">
                {userRole === "admin" ? "Edit work order" : "Edit details"}
              </button>
            )}
            {userRole === "admin" && (
              <button
                type="button"
                onClick={() => {
                  setShowDeleteWorkOrderWarning(true);
                  setDeleteConfirmInput("");
                  setDeleteWorkOrderError("");
                }}
                disabled={inlineEditing}
                className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-50"
              >
                Delete Work Order
              </button>
            )}
            {userRole === "admin" && !isPublished && (
              <button
                type="button"
                onClick={() => void handlePublishWorkOrder()}
                disabled={publishingWorkOrder || inlineEditing}
                className="rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200 transition disabled:opacity-60"
              >
                {publishingWorkOrder ? "Publishing..." : "Publish Work Order"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActionError("");
                setShowStatusChange(true);
              }}
              disabled={!canChangeStatus || inlineEditing}
              className="tl-btn px-4 py-2 text-sm"
              title={
                inlineEditing
                  ? "Finish or cancel edit mode first."
                  : canChangeStatus
                    ? "Change work order status"
                    : "Only employees and admins can change status."
              }
            >
              Change Status
            </button>
          </div>
        </div>

        {inlineEditing && (
          <div className="sticky top-0 z-20 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 text-sm font-bold"
                  aria-hidden
                >
                  ✎
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-amber-950">Edit mode in progress</p>
                  <p className="text-sm text-amber-900/85">
                    You are editing this work order on the page. Changes are not saved until you tap{" "}
                    <span className="font-medium">Save changes</span>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelInlineEdit}
                  disabled={savingEdits}
                  className="rounded-full border border-amber-800/25 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100/80 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="work-order-inline-edit"
                  disabled={savingEdits}
                  className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 transition disabled:opacity-50"
                >
                  {savingEdits ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
            {editError && (
              <p className="mt-3 text-sm font-medium text-red-700" role="alert">
                {editError}
              </p>
            )}
          </div>
        )}

        {actionError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
        {publishMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {publishMessage}
          </div>
        )}
        {isPublished && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            This work order is published and visible wherever published work orders appear. Assigned employees and admins can still update the details.
            {workOrder.published_at ? ` Published ${new Date(workOrder.published_at).toLocaleString()}.` : ""}
          </div>
        )}

        <form id="work-order-inline-edit" onSubmit={handleUpdateWorkOrder} className="space-y-6">
          {/* Work Details */}
          <div className="tl-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-(--text)">Work details</h2>
            {inlineEditing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Priority *</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as WorkOrder["priority"] })}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    >
                      <option value="emergency">Board Approval Level</option>
                      <option value="high">Priority - Immediate</option>
                      <option value="normal">Priority - Moderate</option>
                      <option value="low">Priority - Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Service type *</label>
                    <select
                      value={editForm.service_type}
                      onChange={(e) =>
                        setEditForm({ ...editForm, service_type: e.target.value as WorkOrder["service_type"] })
                      }
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
                    <label className="block text-sm font-medium text-(--text) mb-1">Time received</label>
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
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Priority</p>
                    <p className="text-sm font-medium text-(--text) mt-1 capitalize">{workOrder.priority}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Service type</p>
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
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Time received</p>
                    <p className="text-sm font-medium text-(--text) mt-1">
                      {formatWallClockTime12Hour(workOrder.time_received) || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Linked project</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.project_name || "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-(--text)/60 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-(--text) mt-1 whitespace-pre-wrap">{workOrder.description}</p>
                </div>
              </>
            )}
          </div>

          {/* Contact & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="tl-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Contact information</h2>
              {inlineEditing ? (
                <div className="grid grid-cols-1 gap-4">
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-(--text) mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-(--text) mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-(--text) mb-1">Company</label>
                    <input
                      type="text"
                      value={editForm.company}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                      className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-(--text) mb-1">Department</label>
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Phone</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Company</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.company || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Department</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.department || "—"}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="tl-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Location</h2>
              {inlineEditing ? (
                <div className="space-y-4">
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-(--text) mb-1">Location / building</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-(--text) mb-1">Unit</label>
                    <input
                      type="text"
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                      className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-sm font-medium text-(--text) mb-1">Area</label>
                    <input
                      type="text"
                      value={editForm.area}
                      onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                      className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-(--text) mb-1">Access needed</label>
                      <input
                        type="text"
                        value={editForm.access_needed}
                        onChange={(e) => setEditForm({ ...editForm, access_needed: e.target.value })}
                        className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-(--text) mb-1">Preferred entry time</label>
                      <input
                        type="text"
                        value={editForm.preferred_entry_time}
                        onChange={(e) => setEditForm({ ...editForm, preferred_entry_time: e.target.value })}
                        className="w-full min-w-0 px-4 py-3 text-base rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Location / unit / area</p>
                    <p className="text-sm font-medium text-(--text) mt-1">
                      {[workOrder.location, workOrder.unit, workOrder.area].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Access needed</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.access_needed || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-(--text)/60 uppercase tracking-wide">Preferred entry time</p>
                    <p className="text-sm font-medium text-(--text) mt-1">{workOrder.preferred_entry_time || "—"}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assignment & execution */}
          <div className="tl-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-(--text)">Assignment & execution</h2>
            {inlineEditing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userRole === "admin" && (
                    <div>
                      <label className="block text-sm font-medium text-(--text) mb-1">Assign to</label>
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
                  )}
                  {userRole === "admin" && (
                    <div>
                      <label className="block text-sm font-medium text-(--text) mb-1">Linked project</label>
                      <select
                        value={editForm.project_id}
                        onChange={(e) => setEditForm({ ...editForm, project_id: e.target.value })}
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
                  )}
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Scheduled date</label>
                    <input
                      type="date"
                      value={editForm.scheduled_date}
                      onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Scheduled time</label>
                    <input
                      type="time"
                      value={editForm.scheduled_time}
                      onChange={(e) => setEditForm({ ...editForm, scheduled_time: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Time in</label>
                    <input
                      type="time"
                      value={editForm.time_in}
                      onChange={(e) => setEditForm({ ...editForm, time_in: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Time out</label>
                    <input
                      type="time"
                      value={editForm.time_out}
                      onChange={(e) => setEditForm({ ...editForm, time_out: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Total labor hours</label>
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
                    <label className="block text-sm font-medium text-(--text) mb-1">Workflow status</label>
                    <select
                      value={editForm.work_completed}
                      onChange={(e) =>
                        setEditForm({ ...editForm, work_completed: e.target.value as WorkOrder["work_completed"] })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    >
                      {availableStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatWorkOrderStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Completed date</label>
                    <input
                      type="date"
                      value={editForm.completed_date}
                      onChange={(e) => setEditForm({ ...editForm, completed_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Completed time</label>
                    <input
                      type="time"
                      value={editForm.completed_time}
                      onChange={(e) => setEditForm({ ...editForm, completed_time: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">Work summary</label>
                  <textarea
                    value={editForm.work_summary}
                    onChange={(e) => setEditForm({ ...editForm, work_summary: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
                {userRole === "admin" && (
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">Admin close-out note</label>
                    <textarea
                      value={editForm.status_note}
                      onChange={(e) => setEditForm({ ...editForm, status_note: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-(--text)/60 uppercase tracking-wide">Assigned to</p>
                  <p className="text-sm font-medium text-(--text) mt-1">{workOrder.assigned_user_name || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-(--text)/60 uppercase tracking-wide">Linked project</p>
                  <p className="text-sm font-medium text-(--text) mt-1">{workOrder.project_name || "—"}</p>
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
                  <p className="text-xs text-(--text)/60 uppercase tracking-wide">Workflow status</p>
                  <p className="text-sm font-medium text-(--text) mt-1">
                    {formatWorkOrderStatusLabel(workOrder.work_completed)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--text)/60 uppercase tracking-wide">Time in / out</p>
                  <p className="text-sm font-medium text-(--text) mt-1">
                    {workOrder.time_in || "—"} / {workOrder.time_out || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--text)/60 uppercase tracking-wide">Total labor hours</p>
                  <p className="text-sm font-medium text-(--text) mt-1">
                    {workOrder.total_labor_hours != null ? workOrder.total_labor_hours.toFixed(2) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--text)/60 uppercase tracking-wide">Completed</p>
                  <p className="text-sm font-medium text-(--text) mt-1">
                    {workOrder.completed_date
                      ? `${new Date(workOrder.completed_date).toLocaleDateString()}${
                          workOrder.completed_time ? ` · ${workOrder.completed_time}` : ""
                        }`
                      : "—"}
                  </p>
                </div>
              </div>
            )}
            {!inlineEditing && (
              <div>
                <p className="text-xs text-(--text)/60 uppercase tracking-wide">Work summary</p>
                <p className={`text-sm mt-1 whitespace-pre-wrap ${workOrder.work_summary ? "text-(--text)" : "text-(--text)/60"}`}>
                  {workOrder.work_summary || "—"}
                </p>
              </div>
            )}
          </div>

          {inlineEditing && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pb-2">
              <button
                type="button"
                onClick={handleCancelInlineEdit}
                disabled={savingEdits}
                className="rounded-full border border-(--border)/40 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition disabled:opacity-50"
              >
                Cancel editing
              </button>
              <button
                type="submit"
                disabled={savingEdits}
                className="tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {savingEdits ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </form>

        <MaterialPurchaseManager
          endpoint={`/api/work-orders/${id}/material-purchases`}
          title="Materials & Parts"
          description="Add material photos (parts and supplies), store receipts with totals, and keep optional legacy line items for reporting."
          materialPhotosEndpoint={`/api/work-orders/${id}/photos`}
          canManage={canAddMaterial}
          lockedMessage={sharedEditRestrictionMessage}
          onTotalChange={setReceiptMaterialsTotal}
        />

        <div className="tl-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-(--text)">Materials Cost Summary</h2>
              <p className="mt-1 text-sm text-(--text)/60">
                Receipt purchases are the new primary flow. Legacy materials remain available if you still need the old itemized format.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-(--text)/45">Total Materials Cost</p>
              <p className="text-2xl font-semibold text-(--text)">${combinedMaterialsTotal.toFixed(2)}</p>
            </div>
          </div>
          <div className={`grid grid-cols-1 gap-3 ${showLegacyMaterials ? "sm:grid-cols-2" : ""}`}>
            <div className="rounded-2xl border border-(--border)/20 bg-(--bg)/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-(--text)/45">Receipt Purchases</p>
              <p className="mt-1 text-lg font-semibold text-(--text)">${receiptMaterialsTotal.toFixed(2)}</p>
            </div>
            {showLegacyMaterials && (
              <div className="rounded-2xl border border-(--border)/20 bg-(--bg)/40 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-(--text)/45">Legacy Materials</p>
                <p className="mt-1 text-lg font-semibold text-(--text)">${legacyMaterialsTotal.toFixed(2)}</p>
              </div>
            )}
          </div>
          <div className="border-t border-(--border)/20 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-(--text)">Legacy Materials & Parts</p>
                <p className="mt-1 text-xs text-(--text)/55">
                  Optional backup for the old itemized entry system.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLegacyMaterials((current) => !current)}
                  className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  {showLegacyMaterials ? "Hide Legacy" : "Show Legacy"}
                </button>
                {showLegacyMaterials && (
                  <button
                    onClick={() => setShowAddMaterial(true)}
                    disabled={!canAddMaterial}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                    title={materialActionTitle}
                  >
                    + Add Legacy Material
                  </button>
                )}
              </div>
            </div>

            {showLegacyMaterials && (
              <div className="mt-4 space-y-4">
                {materials.length === 0 ? (
                  <p className="text-sm text-(--text)/60">No legacy materials recorded.</p>
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
                            {canAddMaterial && (
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
                        Legacy Total: ${legacyMaterialsTotal.toFixed(2)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <EntityPhotoManager
          endpoint={`/api/work-orders/${id}/photos`}
          title="Before & after photos"
          description="Document the site before work starts and after work is finished."
          allowedRoles={["before", "after"]}
          canManage={canManagePhotos}
          lockedMessage={photoLockedMessage}
        />

        <div className="tl-card p-6 space-y-4 border border-(--border)/25 bg-(--bg)/30">
          <h2 className="text-lg font-semibold text-(--text)">Close-out audit</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-(--text)/55">Current workflow status</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[workOrder.work_completed]}`}
            >
              {formatWorkOrderStatusLabel(workOrder.work_completed)}
            </span>
          </div>
          <div className="text-sm text-(--text)/80 space-y-2">
            <p>
              <span className="font-medium text-(--text)">Last status change logged: </span>
              {workOrder.status_updated_at ? (
                <>
                  {formatUsCentralDateTime(workOrder.status_updated_at)} CT
                  {workOrder.status_updated_by_name ? ` · ${workOrder.status_updated_by_name}` : ""}
                </>
              ) : (
                <>
                  Not recorded yet for this work order. A log entry is created when someone changes workflow status using{" "}
                  <strong className="font-semibold text-(--text)">Change status</strong> or saves a different status in{" "}
                  <strong className="font-semibold text-(--text)">Assignment &amp; execution</strong> (edit mode).
                </>
              )}
            </p>
            {!workOrder.status_updated_at && (
              <p className="text-xs text-(--text)/60">
                Last saved (any update): {formatUsCentralDateTime(workOrder.updated_at)} CT
              </p>
            )}
          </div>
          {workOrder.status_note ? (
            <div className="rounded-xl border border-(--border)/30 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-(--text)/55">Admin close-out note</p>
              <p className="mt-2 text-sm text-(--text) whitespace-pre-wrap">{workOrder.status_note}</p>
            </div>
          ) : (
            <p className="text-sm text-(--text)/55">
              No admin close-out note on file.
              {userRole === "employee" && (
                <span className="block mt-1 text-xs text-(--text)/50">
                  Notes in this section are added by administrators when they update status or edit the work order.
                </span>
              )}
            </p>
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
                  <p className="text-xs text-(--text)/60">{formatUsCentralDateTime(tlCorpSignature.signed_at)} CT</p>
                </div>
              ) : (
                <button
                  onClick={() => void handleTapSignature("tl_corp_rep")}
                  disabled={!canCaptureSignature}
                  className="w-full border-2 border-dashed border-(--border) rounded-lg p-4 text-sm text-(--text)/60 hover:border-(--ring) hover:text-(--text) transition disabled:opacity-50"
                  title={signatureActionTitle}
                >
                  Tap to sign
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
                  <p className="text-xs text-(--text)/60">{formatUsCentralDateTime(buildingRepSignature.signed_at)} CT</p>
                </div>
              ) : (
                <button
                  onClick={() => void handleTapSignature("building_rep")}
                  disabled={!canCaptureSignature}
                  className="w-full border-2 border-dashed border-(--border) rounded-lg p-4 text-sm text-(--text)/60 hover:border-(--ring) hover:text-(--text) transition disabled:opacity-50"
                  title={signatureActionTitle}
                >
                  Tap to sign
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
      {showStatusChange && canChangeStatus && (
        <ModalLayer align="center" className="bg-black/50" onBackdropClick={() => setShowStatusChange(false)}>
          <div className="tl-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text)">Change Status</h3>
            <p className="text-xs text-(--text)/60 mt-1 mb-4">
              The outlined option is the current status. Pick another to save and close, or tap the current one to dismiss.
            </p>
            {actionError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>
            )}
            <div className="space-y-2">
              {availableStatusOptions.map((status) => {
                const isCurrent = workOrder.work_completed === status;
                const dotClass = STATUS_COLORS[status]
                  .replace("text-", "bg-")
                  .replace("-100", "-500")
                  .replace("-700", "-500");
                const isCancelled = status === "cancelled";
                return (
                  <button
                    type="button"
                    key={status}
                    onClick={() => {
                      if (isCurrent) {
                        setShowStatusChange(false);
                        return;
                      }
                      void handleStatusChange(status);
                    }}
                    disabled={updating}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition border-2 ${
                      isCurrent
                        ? "border-(--ring) bg-(--bg) text-(--text) shadow-sm"
                        : isCancelled
                          ? "border-transparent text-(--text) hover:bg-red-50 hover:border-red-200/80"
                          : "border-transparent text-(--text) hover:bg-(--bg) hover:border-(--border)/40"
                    } ${updating && !isCurrent ? "opacity-60" : ""}`}
                  >
                    <span className="flex min-w-0 items-center">
                      {isCancelled ? (
                        <span
                          className="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
                          aria-hidden
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      ) : (
                        <span className={`inline-block h-3 w-3 shrink-0 rounded-full mr-3 ${dotClass}`} aria-hidden />
                      )}
                      <span className="truncate">{formatWorkOrderStatusLabel(status)}</span>
                      {isCurrent && (
                        <span className="ml-2 shrink-0 rounded-md bg-(--ring)/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--ring)">
                          Current
                        </span>
                      )}
                    </span>
                    {isCurrent && (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--ring)/15 text-(--ring)"
                        aria-hidden
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {userRole === "admin" && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-(--text)">Admin Close-Out Note</label>
                <textarea
                  value={statusChangeNote}
                  onChange={(event) => setStatusChangeNote(event.target.value)}
                  rows={3}
                  placeholder="Add close-out context, handoff details, or reason for status change"
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
            )}
            <button
              onClick={() => setShowStatusChange(false)}
              className="w-full mt-4 px-4 py-2.5 rounded-full border border-(--border)/30 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Cancel
            </button>
          </div>
        </ModalLayer>
      )}

      {/* Add Material Modal */}
      {showAddMaterial && canAddMaterial && (
        <ModalLayer align="center" className="bg-black/50" onBackdropClick={() => setShowAddMaterial(false)}>
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
        </ModalLayer>
      )}

      {showDeleteWorkOrderWarning && (
        <ModalLayer
          align="center"
          className="bg-black/50"
          onBackdropClick={() => {
            if (deletingWorkOrder) return;
            setShowDeleteWorkOrderWarning(false);
            setDeleteConfirmInput("");
            setDeleteWorkOrderError("");
          }}
        >
          <div className="tl-card p-6 w-full max-w-md space-y-4" onClick={(event) => event.stopPropagation()}>
            <div>
              <h3 className="text-lg font-semibold text-red-700">Delete Work Order Warning</h3>
              <p className="text-sm text-(--text)/75 mt-2">
                This will permanently delete work order <strong>{workOrder.work_order_number}</strong> and cannot be undone.
              </p>
              <p className="text-sm text-(--text)/75 mt-1">
                Type <strong>{workOrder.work_order_number}</strong> to confirm.
              </p>
            </div>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => {
                setDeleteConfirmInput(event.target.value);
                if (deleteWorkOrderError) setDeleteWorkOrderError("");
              }}
              placeholder={`Type ${workOrder.work_order_number}`}
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
                  setShowDeleteWorkOrderWarning(false);
                  setDeleteConfirmInput("");
                  setDeleteWorkOrderError("");
                }}
                className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteWorkOrder()}
                disabled={deletingWorkOrder}
                className="flex-1 rounded-full bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 transition disabled:opacity-60"
              >
                {deletingWorkOrder ? "Deleting..." : "Delete Now"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}

    </div>
  );
}

