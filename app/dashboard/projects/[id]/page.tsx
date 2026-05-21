"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ModalLayer } from "@/app/components/ModalLayer";
import { formatUsCentralDateTime } from "@/lib/us-central-time";
import { buildTapSignatureImage, getTapSignedAtLabel } from "@/app/components/tap-signature";
import { PREDEFINED_CATEGORIES } from "@/lib/estimate-categories";
import {
  calculateEstimateBreakdown,
  calculateInstallmentAmounts,
  formatCurrency,
  type InstallmentScheduleItem,
} from "@/lib/estimate";
import type { EstimateEngagementSummary } from "@/lib/estimate-engagement";
import EstimateEngagementStatus from "@/app/components/EstimateEngagementStatus";
import ClientProfileFields, {
  emptyClientProfileForm,
  type ClientProfileFormState,
} from "@/app/components/ClientProfileFields";
import { resolveClientAddresses } from "@/lib/client-addresses";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  hide_line_item_prices_for_client: boolean;
  hide_markup_for_client: boolean;
  is_funded: boolean;
  funding_notes: string | null;
  on_hold_reason: string | null;
  expected_resume_date: string | null;
  created_at: string;
  estimate_sent?: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  created_at: string;
}

interface TaskStats {
  total: number;
  completed: number;
}

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
}

interface ProjectImage {
  id: string;
  filename: string;
  s3_url: string | null;
  caption: string | null;
  uploader_name?: string;
  created_at: string;
}

interface ProjectUpdate {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  user_name?: string;
}

interface ProjectInvitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  inviter_name?: string;
  created_at: string;
  accepted_at: string | null;
}

interface User {
  id: string;
  role: "admin" | "employee" | "client";
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface Assignment {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface ProjectSignature {
  id: string;
  signer_role: "admin" | "client";
  signer_name: string;
  signature_data: string;
  signed_at: string;
}

interface CrmClientPickerItem {
  id: string;
  email: string;
  full_name: string;
  user_id: string | null;
  invitation_status: "none" | "pending" | "accepted" | "expired";
}

type InviteClientOption = {
  key: string;
  label: string;
  email: string;
  status: "active" | "pending" | "profile";
  crmClientId?: string;
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({ total: 0, completed: 0 });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [projectSignatures, setProjectSignatures] = useState<ProjectSignature[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);
  const [estimateEditForm, setEstimateEditForm] = useState({
    description: "",
    price_rate: "",
    quantity: "",
  });

  // Estimate builder state
  interface EstimateLineItem {
    id: string;
    category: string;
    custom_category_name: string | null;
    description: string | null;
    price_rate: number;
    quantity: number;
    total: number;
  }
  const [estimateItems, setEstimateItems] = useState<EstimateLineItem[]>([]);
  const [estimateTotal, setEstimateTotal] = useState(0);
  const [showAddEstimateItem, setShowAddEstimateItem] = useState(false);
  const [newEstimateItem, setNewEstimateItem] = useState({
    category: "Demo",
    customName: "",
    description: "",
    priceRate: "",
    quantity: "1",
  });
  const [markupType, setMarkupType] = useState<"percentage" | "fixed">("percentage");
  const [markupValue, setMarkupValue] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [onlineServicingFee, setOnlineServicingFee] = useState(true);
  const [installmentSchedule, setInstallmentSchedule] = useState<InstallmentScheduleItem[]>([]);
  const [estimateSent, setEstimateSent] = useState(false);
  const [estimateEngagement, setEstimateEngagement] = useState<EstimateEngagementSummary | null>(null);
  const [showSendEstimate, setShowSendEstimate] = useState(false);
  const [sendRecipients, setSendRecipients] = useState<
    Array<{ id: string | null; email: string; name: string; status: "registered" | "invited" }>
  >([]);
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState("");
  const [sendingEstimate, setSendingEstimate] = useState(false);
  const [sendRecipientsLoading, setSendRecipientsLoading] = useState(false);
  const [sendRecipientsError, setSendRecipientsError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [previewClientView, setPreviewClientView] = useState(false);
  const [savingClientVisibility, setSavingClientVisibility] = useState(false);

  function getEstimateBreakdown() {
    const subtotal = estimateTotal;
    return calculateEstimateBreakdown(subtotal, {
      markup_type: markupType,
      markup_value: parseFloat(markupValue) || 0,
      tax_rate: parseFloat(taxRate) || 0,
      servicing_fee: onlineServicingFee,
    });
  }

  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<ProjectImage | null>(null);
  const [showInviteCustomer, setShowInviteCustomer] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [newImage, setNewImage] = useState({ filename: "", caption: "" });
  const [newUpdate, setNewUpdate] = useState({ title: "", content: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [crmClientsList, setCrmClientsList] = useState<CrmClientPickerItem[]>([]);
  const [inviteClientsLoading, setInviteClientsLoading] = useState(false);
  const [inviteClientsError, setInviteClientsError] = useState("");
  const [inviteClientSearch, setInviteClientSearch] = useState("");
  const [inviteMode, setInviteMode] = useState<"existing" | "new">("existing");
  const [selectedCrmClientId, setSelectedCrmClientId] = useState("");
  const [selectedInviteEmail, setSelectedInviteEmail] = useState("");
  const [newClientForm, setNewClientForm] = useState<ClientProfileFormState>(
    emptyClientProfileForm()
  );
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    status: "",
    budget_amount: "",
    hide_line_item_prices_for_client: false,
    hide_markup_for_client: false,
    is_funded: false,
    funding_notes: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = currentUser?.role || "client";
  const canManageTasks = userRole === "admin" || userRole === "employee";
  const canCreateTasks = userRole === "admin";
  const canManageImages = userRole === "admin" || userRole === "employee";
  const canEdit = userRole === "admin";
  const canAddUpdates = userRole === "admin" || userRole === "employee";
  const canViewEstimate = userRole === "admin" || (userRole === "client" && estimateSent);
  const canManageEstimate = userRole === "admin";
  const canSignProject = userRole === "admin" || userRole === "client";

  const fetchData = useCallback(async () => {
    try {
      const [projectRes, sessionRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch("/api/auth/session"),
      ]);

      if (!projectRes.ok) {
        router.push("/dashboard");
        return;
      }

      const projectData = await projectRes.json();
      const sessionData = await sessionRes.json();

      setProject(projectData.project);
      setEstimateSent(Boolean(projectData.project.estimate_sent));
      setCurrentUser(sessionData.user);

      setEditForm({
        name: projectData.project.name || "",
        status: projectData.project.status,
        budget_amount: projectData.project.budget_amount?.toString() || "",
        hide_line_item_prices_for_client:
          Boolean(projectData.project.hide_line_item_prices_for_client),
        hide_markup_for_client: Boolean(projectData.project.hide_markup_for_client),
        is_funded: projectData.project.is_funded,
        funding_notes: projectData.project.funding_notes || "",
      });

      // Fetch related data
      const [tasksRes, teamRes, imagesRes, updatesRes, invitationsRes, estimateRes, settingsRes, signaturesRes, usersRes, assignmentsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/team`),
        fetch(`/api/projects/${projectId}/images`),
        fetch(`/api/projects/${projectId}/updates`),
        sessionData.user?.role === "admin"
          ? fetch(`/api/projects/${projectId}/invitations`)
          : Promise.resolve({ json: () => Promise.resolve({ invitations: [] }) }),
        sessionData.user?.role === "admin" || projectData.project.estimate_sent
          ? fetch(`/api/projects/${projectId}/estimate`)
          : Promise.resolve({ ok: false, json: () => Promise.resolve({ items: [], total: 0, estimate_sent: false }) }),
        sessionData.user?.role === "admin"
          ? fetch(`/api/projects/${projectId}/estimate/settings`)
          : Promise.resolve({ ok: false, json: () => Promise.resolve({ settings: null }) }),
        sessionData.user?.role !== "employee"
          ? fetch(`/api/projects/${projectId}/signatures`)
          : Promise.resolve({ ok: false, json: () => Promise.resolve({ signatures: [] }) }),
        sessionData.user?.role === "admin"
          ? fetch("/api/users")
          : Promise.resolve({ ok: false, json: () => Promise.resolve({ users: [] }) }),
        sessionData.user?.role === "admin"
          ? fetch(`/api/projects/${projectId}/assignments`)
          : Promise.resolve({ ok: false, json: () => Promise.resolve({ assignments: [] }) }),
      ]);

      const tasksData = await tasksRes.json();
      const teamData = await teamRes.json();
      const imagesData = await imagesRes.json();
      const updatesData = await updatesRes.json();
      const invitationsData = await invitationsRes.json();
      const estimateData = await estimateRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : { settings: null };
      const signaturesData = await signaturesRes.json();
      const usersData = await usersRes.json();
      const assignmentsData = await assignmentsRes.json();

      setTasks(tasksData.tasks || []);
      setStats(tasksData.stats || { total: 0, completed: 0 });
      setTeam(teamData.team || []);
      setImages(imagesData.images || []);
      setUpdates(updatesData.updates || []);
      setInvitations(invitationsData.invitations || []);
      if (estimateRes.ok) {
        setEstimateItems(estimateData.items || []);
        setEstimateTotal(estimateData.total || 0);
        setEstimateSent(Boolean(estimateData.estimate_sent));
        setEstimateEngagement(estimateData.engagement || null);
      }
      if (settingsData.settings) {
        const s = settingsData.settings;
        setMarkupType(s.markup_type || "percentage");
        setMarkupValue(String(s.markup_value || ""));
        setTaxRate(String(s.tax_rate || ""));
        setOnlineServicingFee(Boolean(s.servicing_fee));
        setInstallmentSchedule(s.installment_schedule || []);
        setSettingsLoaded(true);
      }
      setProjectSignatures(signaturesData.signatures || []);
      setAllUsers(usersData.users || []);
      setAssignments(assignmentsData.assignments || []);
    } catch (error) {
      console.error("Failed to fetch project:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function saveEstimateSettings() {
    if (!canManageEstimate) return;
    setSavingSettings(true);
    try {
      await fetch(`/api/projects/${projectId}/estimate/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markup_type: markupType,
          markup_value: parseFloat(markupValue) || 0,
          tax_rate: parseFloat(taxRate) || 0,
          servicing_fee: onlineServicingFee,
          installment_schedule: installmentSchedule,
        }),
      });
    } catch (error) {
      console.error("Failed to save estimate settings:", error);
    } finally {
      setSavingSettings(false);
    }
  }

  useEffect(() => {
    if (!canManageEstimate || !settingsLoaded) return;
    const timer = setTimeout(() => {
      saveEstimateSettings();
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markupType, markupValue, taxRate, onlineServicingFee, installmentSchedule, settingsLoaded]);

  async function openSendEstimateModal() {
    setShowInviteCustomer(false);
    setShowSendEstimate(true);
    setSendRecipientsLoading(true);
    setSendRecipientsError("");
    setSelectedRecipientEmail("");
    setSendRecipients([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate/send`);
      const data = await res.json();
      if (!res.ok) {
        setSendRecipientsError(data.error || "Failed to load estimate recipients.");
        return;
      }
      const recipients = data.recipients || data.clients || [];
      setSendRecipients(recipients);
      if (recipients.length === 1) {
        setSelectedRecipientEmail(recipients[0].email);
      }
    } catch (error) {
      console.error("Failed to load recipients:", error);
      setSendRecipientsError("Failed to load estimate recipients.");
    } finally {
      setSendRecipientsLoading(false);
    }
  }

  async function handleSendEstimate() {
    if (!canManageEstimate || estimateItems.length === 0) return;
    const recipient = sendRecipients.find((r) => r.email === selectedRecipientEmail);
    if (!selectedRecipientEmail) return;

    setSendingEstimate(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_user_id: recipient?.id || undefined,
          recipient_email: selectedRecipientEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowSendEstimate(false);
        fetchData();
      } else {
        alert(data.error || "Failed to send estimate");
      }
    } catch (error) {
      console.error("Failed to send estimate:", error);
      alert("Failed to send estimate");
    } finally {
      setSendingEstimate(false);
    }
  }

  function updateInstallment(index: number, field: keyof InstallmentScheduleItem, value: string | number) {
    setInstallmentSchedule((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addInstallmentRow() {
    setInstallmentSchedule((prev) => [
      ...prev,
      { label: "Payment", percent: 0, due_description: "" },
    ]);
  }

  function removeInstallmentRow(index: number) {
    setInstallmentSchedule((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateTasks) return;
    if (!newTask.title.trim()) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      if (res.ok) {
        setNewTask({ title: "", description: "" });
        setShowAddTask(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  }

  async function handleToggleTask(task: Task) {
    if (!canManageTasks) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          is_completed: !task.is_completed,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? data.task : t))
        );
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (userRole !== "admin") return;

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  }

  async function handleGenerateTasks() {
    setGeneratingTasks(true);
    setGenerateError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (res.ok) {
        fetchData();
      } else {
        setGenerateError(data.error || "Failed to generate tasks");
      }
    } catch (error) {
      console.error("Failed to generate tasks:", error);
      setGenerateError("Failed to generate tasks. Please try again.");
    } finally {
      setGeneratingTasks(false);
    }
  }

  async function handleAddEstimateItem(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newEstimateItem.category === "Custom" ? "custom" : newEstimateItem.category,
          custom_category_name: newEstimateItem.category === "Custom" ? newEstimateItem.customName : undefined,
          description: newEstimateItem.description,
          price_rate: parseFloat(newEstimateItem.priceRate) || 0,
          quantity: parseFloat(newEstimateItem.quantity) || 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEstimateItems((prev) => [...prev, data.item]);
        setEstimateTotal(data.total);
        setShowAddEstimateItem(false);
        setNewEstimateItem({ category: "Demo", customName: "", description: "", priceRate: "", quantity: "1" });
        // Update project budget to match
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` }),
        });
        if (project) setProject({ ...project, budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` });
        setProjectSignatures([]);
      }
    } catch (error) {
      console.error("Failed to add estimate item:", error);
    }
  }

  async function handleDeleteEstimateItem(itemId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

      if (res.ok) {
        const data = await res.json();
        setEstimateItems((prev) => prev.filter((item) => item.id !== itemId));
        setEstimateTotal(data.total);
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` }),
        });
        if (project) setProject({ ...project, budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` });
        setProjectSignatures([]);
      }
    } catch (error) {
      console.error("Failed to delete estimate item:", error);
    }
  }

  function startEditEstimateItem(item: EstimateLineItem) {
    setEditingEstimateId(item.id);
    setEstimateEditForm({
      description: item.description || "",
      price_rate: String(item.price_rate),
      quantity: String(item.quantity),
    });
  }

  function cancelEditEstimateItem() {
    setEditingEstimateId(null);
    setEstimateEditForm({ description: "", price_rate: "", quantity: "" });
  }

  async function handleSaveEstimateItem(itemId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          description: estimateEditForm.description,
          price_rate: parseFloat(estimateEditForm.price_rate) || 0,
          quantity: parseFloat(estimateEditForm.quantity) || 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEstimateItems((prev) =>
          prev.map((item) => (item.id === itemId ? data.item : item))
        );
        setEstimateTotal(data.total);
        cancelEditEstimateItem();
        setProjectSignatures([]);
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budget_amount: data.total,
            funding_notes: `Estimate Total: $${data.total.toLocaleString()}`,
          }),
        });
        if (project) {
          setProject({
            ...project,
            budget_amount: data.total,
            funding_notes: `Estimate Total: $${data.total.toLocaleString()}`,
          });
        }
      }
    } catch (error) {
      console.error("Failed to update estimate item:", error);
    }
  }

  async function handleAssignEmployee(userId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        window.alert(data.error || "Failed to assign employee");
      }
    } catch (error) {
      console.error("Failed to assign employee:", error);
    }
  }

  async function handleUnassignEmployee(userId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/assignments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        window.alert(data.error || "Failed to unassign employee");
      }
    } catch (error) {
      console.error("Failed to unassign employee:", error);
    }
  }

  async function handleTapProjectSignature() {
    if (!currentUser) return;

    try {
      const signerName = `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() || "Signer";
      const signatureData = buildTapSignatureImage(
        signerName,
        getTapSignedAtLabel(),
        userRole === "admin" ? "Admin" : "Client"
      );
      if (!signatureData) return;
      const res = await fetch(`/api/projects/${projectId}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: signerName,
          signature_data: signatureData,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProjectSignatures(data.signatures || []);
      } else {
        window.alert(data.error || "Failed to save signature");
      }
    } catch (error) {
      console.error("Failed to save signature:", error);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export-pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Failed to export PDF");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name || "project"}-summary.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleAddImage(e: React.FormEvent) {
    e.preventDefault();
    if (!newImage.filename.trim()) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newImage),
      });

      if (res.ok) {
        setNewImage({ filename: "", caption: "" });
        setShowAddImage(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to add image:", error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", newImage.caption || "");

      const res = await fetch(`/api/projects/${projectId}/images`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setNewImage({ filename: "", caption: "" });
        setShowAddImage(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to upload image:", error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (userRole !== "admin") return;

    try {
      const res = await fetch(`/api/projects/${projectId}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });

      if (res.ok) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        setShowImageViewer(null);
      }
    } catch (error) {
      console.error("Failed to delete image:", error);
    }
  }

  async function handleAddUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!canAddUpdates) return;
    if (!newUpdate.title.trim()) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUpdate),
      });

      if (res.ok) {
        setNewUpdate({ title: "", content: "" });
        setShowAddUpdate(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to add update:", error);
    }
  }

  async function saveClientVisibility(updates: {
    hide_line_item_prices_for_client?: boolean;
    hide_markup_for_client?: boolean;
  }) {
    setSavingClientVisibility(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setEditForm((prev) => ({
          ...prev,
          hide_line_item_prices_for_client: Boolean(
            data.project.hide_line_item_prices_for_client
          ),
          hide_markup_for_client: Boolean(data.project.hide_markup_for_client),
        }));
      }
    } catch (error) {
      console.error("Failed to save client visibility settings:", error);
    } finally {
      setSavingClientVisibility(false);
    }
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      window.alert("Project name is required.");
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          status: editForm.status,
          budget_amount: editForm.budget_amount
            ? parseFloat(editForm.budget_amount)
            : null,
          hide_line_item_prices_for_client: editForm.hide_line_item_prices_for_client,
          hide_markup_for_client: editForm.hide_markup_for_client,
          is_funded: editForm.is_funded,
          funding_notes: editForm.funding_notes || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setProjectSignatures([]);
        setShowEditProject(false);
      } else {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Failed to update project");
      }
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  }

  async function openInviteCustomerModal() {
    setShowSendEstimate(false);
    setShowInviteCustomer(true);
    setInviteMode("existing");
    setSelectedCrmClientId("");
    setSelectedInviteEmail("");
    setInviteClientSearch("");
    setInviteClientsError("");
    setNewClientForm(emptyClientProfileForm());
    setInviteClientsLoading(true);
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setCrmClientsList(data.clients || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setInviteClientsError(data.error || "Could not load CRM clients.");
      }
    } catch {
      console.error("Failed to load CRM clients");
      setInviteClientsError("Could not load CRM clients.");
    } finally {
      setInviteClientsLoading(false);
    }
  }

  async function handleInviteCustomer(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    try {
      let body: Record<string, unknown>;
      if (inviteMode === "existing") {
        if (!selectedCrmClientId && !selectedInviteEmail) {
          alert("Select a client to invite");
          return;
        }
        body = selectedCrmClientId
          ? { crm_client_id: selectedCrmClientId }
          : { email: selectedInviteEmail };
      } else {
        if (!newClientForm.email.trim() || !newClientForm.fullName.trim()) {
          alert("Full name and email are required");
          return;
        }
        const addresses = resolveClientAddresses({
          address: newClientForm.address,
          serviceSameAsAddress: newClientForm.serviceSameAsAddress,
          serviceAddress: newClientForm.serviceAddress,
          billingSameAsAddress: newClientForm.billingSameAsAddress,
          billingAddress: newClientForm.billingAddress,
        });
        body = {
          client: {
            email: newClientForm.email.trim(),
            full_name: newClientForm.fullName.trim(),
            address: addresses.address,
            service_same_as_address: newClientForm.serviceSameAsAddress,
            service_address: addresses.service_address,
            billing_same_as_address: newClientForm.billingSameAsAddress,
            billing_address: addresses.billing_address,
          },
        };
      }

      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setInvitations((prev) => [data.invitation, ...prev]);
        setInviteEmail("");
        setShowInviteCustomer(false);
        const clientsRes = await fetch("/api/clients");
        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setCrmClientsList(clientsData.clients || []);
        }
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

  const progressPercent =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const statusColors: Record<string, string> = {
    planning: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    on_hold: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
  };

  const statusLabels: Record<string, string> = {
    planning: "Planning",
    in_progress: "In Progress",
    on_hold: "On Hold",
    completed: "Completed",
  };

  const inviteClientOptions = useMemo<InviteClientOption[]>(() => {
    const options: InviteClientOption[] = [];
    const seenEmails = new Set<string>();
    const profilesByEmail = new Map(
      crmClientsList.map((client) => [client.email.toLowerCase(), client])
    );

    for (const user of allUsers) {
      if (user.role !== "client" || !user.email) continue;
      const email = user.email.toLowerCase();
      seenEmails.add(email);
      const profile = profilesByEmail.get(email);
      options.push({
        key: `user-${user.id}`,
        label:
          profile?.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email,
        email: user.email,
        status: "active",
        crmClientId: profile?.id,
      });
    }

    for (const client of crmClientsList) {
      const email = client.email.toLowerCase();
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      options.push({
        key: `profile-${client.id}`,
        label: client.full_name,
        email: client.email,
        status: client.invitation_status === "pending" ? "pending" : "profile",
        crmClientId: client.id,
      });
    }

    const query = inviteClientSearch.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.email.toLowerCase().includes(query) ||
        option.status.includes(query)
    );
  }, [allUsers, crmClientsList, inviteClientSearch]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(dateStr: string) {
    return `${formatUsCentralDateTime(dateStr)} CT`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--border)" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-(--text)">Project not found</p>
        <Link
          href="/dashboard"
          className="text-(--text) hover:underline mt-2 inline-block"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const employeeAssignments = assignments.filter((a) => a.role === "employee");
  const availableEmployees = allUsers.filter(
    (u) =>
      u.role === "employee" &&
      !employeeAssignments.some((assignment) => assignment.user_id === u.id)
  );
  const adminSignature = projectSignatures.find((s) => s.signer_role === "admin");
  const clientSignature = projectSignatures.find((s) => s.signer_role === "client");
  const applyClientVisibilityRules = userRole === "client" || previewClientView;
  const hideClientLineItemPricing =
    applyClientVisibilityRules && project.hide_line_item_prices_for_client;
  const hideClientMarkup = applyClientVisibilityRules && project.hide_markup_for_client;

  const estimateItemGridClass = hideClientLineItemPricing
    ? "md:grid md:grid-cols-[5.5rem_minmax(0,1fr)_2.75rem_5.75rem] md:gap-x-4 md:items-center"
    : "md:grid md:grid-cols-[5.5rem_minmax(0,1fr)_5.5rem_2.75rem_6.5rem_5.75rem] md:gap-x-4 md:items-center";

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/dashboard/${userRole}`}
            className="text-sm text-(--text) hover:underline mb-2 inline-flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl font-bold text-(--text) sm:text-3xl break-words">
              {project.name}
            </h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[project.status] || statusColors.planning
              }`}
            >
              {statusLabels[project.status] || project.status}
            </span>
          </div>
          {userRole !== "employee" && project.description && (
            <p className="text-(--text) mt-2 max-w-2xl">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canViewEstimate && (
            <button
              onClick={() => window.open(`/api/projects/${projectId}/export-pdf`, "_blank")}
              disabled={exportingPdf}
              className="rounded-full border border-(--border)/30 px-3 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) disabled:opacity-60 sm:px-4"
            >
              {exportingPdf ? "Exporting..." : "Export PDF"}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowEditProject(true)}
              className="tl-btn px-5 py-2.5 text-sm"
            >
              Edit Project
            </button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="tl-card p-6">
        <h2 className="text-lg font-semibold text-(--text) mb-4">
          Project Progress
        </h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-(--text)">
            {stats.completed} of {stats.total} tasks completed
          </span>
          <span className="text-2xl font-bold text-(--text)">
            {progressPercent}%
          </span>
        </div>
        <div className="h-4 rounded-full overflow-hidden border border-(--tl-slate-300) bg-(--tl-sand)">
          <div
            className="h-full bg-linear-to-r from-(--tl-cyan) to-(--tl-royal) transition-all duration-500 rounded-full"
            style={{ width: `${Math.max(progressPercent, 0)}%` }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details */}
          <div className="tl-card p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-(--text) mb-4">
              Project Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {project.address && (
                <div className="p-4 rounded-xl bg-(--bg)">
                  <p className="text-xs uppercase tracking-wider text-(--text)">
                    Location
                  </p>
                  <p className="text-sm font-medium text-(--text) mt-1">
                    {project.address}
                  </p>
                </div>
              )}
              {userRole !== "employee" && project.start_date && (
                <div className="p-4 rounded-xl bg-(--bg)">
                  <p className="text-xs uppercase tracking-wider text-(--text)">
                    Start Date
                  </p>
                  <p className="text-sm font-medium text-(--text) mt-1">
                    {formatDate(project.start_date)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Estimate Builder */}
          {canManageEstimate && (
          <div className="tl-card min-w-0 overflow-hidden p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-(--text)">
                Estimate Builder
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--bg) px-4 py-3 sm:justify-center sm:rounded-full sm:py-1.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-(--text)/50 sm:hidden">
                    Estimate total
                  </span>
                  <p className="text-xl font-bold text-(--text) sm:text-lg md:text-xl">
                    {formatCurrency(getEstimateBreakdown().total)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:justify-end sm:gap-3">
                <button
                  onClick={() => setShowAddEstimateItem(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-(--tl-navy) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--tl-royal)"
                >
                  <span className="text-base leading-none">+</span>
                  Add Item
                </button>
                {estimateItems.length > 0 && (
                  <button
                    onClick={openSendEstimateModal}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Send to Client
                  </button>
                )}
                </div>
              </div>
            </div>

            {estimateEngagement && (
              <EstimateEngagementStatus
                engagement={estimateEngagement}
                formatDateTime={formatDateTime}
              />
            )}

            <div className="mb-5 rounded-xl border border-(--border) bg-(--bg)/50 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-(--text)">What clients see</p>
                  <p className="mt-0.5 text-xs text-(--text)/60">
                    Applies to sent emails, public estimate links, and the client CRM view.
                  </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-(--text)">
                  <input
                    type="checkbox"
                    checked={previewClientView}
                    onChange={(e) => setPreviewClientView(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Preview client view
                </label>
              </div>
              <div className="space-y-2.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={project.hide_line_item_prices_for_client}
                    disabled={savingClientVisibility}
                    onChange={(e) =>
                      saveClientVisibility({
                        hide_line_item_prices_for_client: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <span className="text-sm text-(--text)">
                    <span className="font-medium">Hide line-item prices</span>
                    <span className="mt-0.5 block text-xs text-(--text)/60">
                      Clients see scope and quantities only — total and payment schedule stay visible.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={project.hide_markup_for_client}
                    disabled={savingClientVisibility}
                    onChange={(e) =>
                      saveClientVisibility({ hide_markup_for_client: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <span className="text-sm text-(--text)">
                    <span className="font-medium">Hide markup, tax &amp; fee breakdown</span>
                    <span className="mt-0.5 block text-xs text-(--text)/60">
                      Clients see the grand total without subtotal, markup, tax, or servicing fee lines.
                    </span>
                  </span>
                </label>
              </div>
              {savingClientVisibility && (
                <p className="mt-2 text-xs text-(--text)/40">Saving...</p>
              )}
              {(project.hide_line_item_prices_for_client || project.hide_markup_for_client) && (
                <p className="mt-3 text-xs text-(--tl-royal)">
                  {project.hide_line_item_prices_for_client && project.hide_markup_for_client
                    ? "Clients will receive scope, total, and payment schedule only."
                    : project.hide_line_item_prices_for_client
                      ? "Clients will see line items without per-line pricing."
                      : "Clients will see line-item prices but not markup/tax/fee details."}
                </p>
              )}
            </div>

            {estimateItems.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-(--border) rounded-xl">
                <svg className="w-12 h-12 mx-auto text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-(--text) mt-3">No estimate items yet</p>
                {userRole === "admin" && (
                  <p className="text-sm text-(--text)">Add line items to build the project estimate</p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {(hideClientLineItemPricing || hideClientMarkup) && (
                  <div className="rounded-xl border border-(--tl-royal)/20 bg-(--tl-royal)/5 px-4 py-2.5 text-xs text-(--text)">
                    {previewClientView && (
                      <span className="mr-2 font-semibold uppercase tracking-wide text-(--tl-royal)">
                        Client preview
                      </span>
                    )}
                    {hideClientLineItemPricing && "Line-item pricing hidden."}{" "}
                    {hideClientMarkup && "Markup/tax/fee breakdown hidden."}
                  </div>
                )}
                {/* Line items table */}
                <div className="overflow-hidden rounded-xl border border-(--border)">
                  <div className={`hidden border-b border-(--border) bg-(--bg)/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-(--text)/55 ${estimateItemGridClass}`}>
                    <div>Category</div>
                    <div>Description</div>
                    {!hideClientLineItemPricing && <div className="text-right">Rate</div>}
                    <div className="text-right">Qty</div>
                    {!hideClientLineItemPricing && <div className="text-right">Total</div>}
                    {userRole === "admin" && <div className="text-right">Actions</div>}
                  </div>
                  <div className="divide-y divide-(--border)">
                {estimateItems.map((item) => {
                  const isEditing = editingEstimateId === item.id;
                  const previewTotal =
                    (parseFloat(estimateEditForm.price_rate) || 0) *
                    (parseFloat(estimateEditForm.quantity) || 0);

                  return (
                  <div
                    key={item.id}
                    className={isEditing ? "bg-(--tl-royal)/5" : ""}
                  >
                    {/* Mobile: card layout */}
                    <div className="space-y-3 px-3 py-4 md:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex max-w-[65%] rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-(--text)">
                          {item.category === "custom" ? item.custom_category_name || "Custom" : item.category}
                        </span>
                        {!isEditing && userRole === "admin" && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              onClick={() => startEditEstimateItem(item)}
                              className="min-h-9 rounded-full border border-(--border) px-3 py-2 text-xs font-semibold text-(--text)"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEstimateItem(item.id)}
                              className="flex min-h-9 min-w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500"
                              aria-label="Delete line item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <>
                          <textarea
                            value={estimateEditForm.description}
                            onChange={(e) =>
                              setEstimateEditForm((prev) => ({ ...prev, description: e.target.value }))
                            }
                            rows={3}
                            placeholder="Description"
                            className="w-full rounded-lg border border-(--border) bg-white px-3 py-2.5 text-base text-(--text) focus:border-(--tl-royal) focus:outline-none focus:ring-2 focus:ring-(--tl-royal)/20"
                          />
                          <div className={`grid gap-3 ${hideClientLineItemPricing ? "grid-cols-1" : "grid-cols-2"}`}>
                            {!hideClientLineItemPricing && (
                              <div>
                                <label className="mb-1 block text-xs font-medium text-(--text)/60">Rate</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  inputMode="decimal"
                                  value={estimateEditForm.price_rate}
                                  onChange={(e) =>
                                    setEstimateEditForm((prev) => ({ ...prev, price_rate: e.target.value }))
                                  }
                                  className="w-full rounded-lg border border-(--border) bg-white px-3 py-2.5 text-base text-(--text) focus:border-(--tl-royal) focus:outline-none focus:ring-2 focus:ring-(--tl-royal)/20"
                                />
                              </div>
                            )}
                            <div>
                              <label className="mb-1 block text-xs font-medium text-(--text)/60">Qty</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                value={estimateEditForm.quantity}
                                onChange={(e) =>
                                  setEstimateEditForm((prev) => ({ ...prev, quantity: e.target.value }))
                                }
                                className="w-full rounded-lg border border-(--border) bg-white px-3 py-2.5 text-base text-(--text) focus:border-(--tl-royal) focus:outline-none focus:ring-2 focus:ring-(--tl-royal)/20"
                              />
                            </div>
                          </div>
                          {!hideClientLineItemPricing && (
                            <div className="flex items-center justify-between rounded-lg bg-(--bg) px-3 py-2.5">
                              <span className="text-sm text-(--text)/60">Line total</span>
                              <span className="text-base font-semibold text-(--tl-navy)">{formatCurrency(previewTotal)}</span>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleSaveEstimateItem(item.id)}
                              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditEstimateItem}
                              className="inline-flex min-h-11 items-center justify-center rounded-full border border-(--border) px-4 py-2.5 text-sm font-semibold text-(--text)"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm leading-relaxed text-(--text) break-words">{item.description || "No description"}</p>
                          <div className={`grid gap-2 rounded-lg bg-(--bg)/80 p-3 text-sm ${hideClientLineItemPricing ? "grid-cols-1" : "grid-cols-3"}`}>
                            {!hideClientLineItemPricing && (
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-(--text)/50">Rate</p>
                                <p className="mt-0.5 font-medium tabular-nums text-(--text)">${item.price_rate.toLocaleString()}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-(--text)/50">Qty</p>
                              <p className="mt-0.5 font-medium tabular-nums text-(--text)">{item.quantity}</p>
                            </div>
                            {!hideClientLineItemPricing && (
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-(--text)/50">Total</p>
                                <p className="mt-0.5 font-semibold tabular-nums text-(--tl-navy)">{formatCurrency(item.total)}</p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Desktop: aligned grid row */}
                    <div className={`hidden px-4 py-3 ${estimateItemGridClass} ${isEditing ? "md:items-start md:py-3.5" : ""}`}>
                      <div className="min-w-0 self-center">
                        <span className="inline-flex rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-(--tl-navy) ring-1 ring-(--border)/60">
                          {item.category === "custom" ? item.custom_category_name || "Custom" : item.category}
                        </span>
                      </div>
                      <div className="min-w-0 self-center">
                        {isEditing ? (
                          <textarea
                            value={estimateEditForm.description}
                            onChange={(e) =>
                              setEstimateEditForm((prev) => ({ ...prev, description: e.target.value }))
                            }
                            rows={2}
                            placeholder="Description"
                            className="w-full rounded-lg border border-(--border) bg-white px-3 py-2 text-sm text-(--text) focus:border-(--tl-royal) focus:outline-none focus:ring-2 focus:ring-(--tl-royal)/20"
                          />
                        ) : (
                          <p className="text-sm leading-snug text-(--text) line-clamp-2">
                            {item.description || "No description"}
                          </p>
                        )}
                      </div>
                      {!hideClientLineItemPricing && (
                        <div className="self-center text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={estimateEditForm.price_rate}
                              onChange={(e) =>
                                setEstimateEditForm((prev) => ({ ...prev, price_rate: e.target.value }))
                              }
                              className="w-full rounded-lg border border-(--border) bg-white px-2.5 py-2 text-right text-sm tabular-nums text-(--text) focus:border-(--tl-royal) focus:outline-none focus:ring-2 focus:ring-(--tl-royal)/20"
                            />
                          ) : (
                            <span className="text-sm tabular-nums text-(--text)">${item.price_rate.toLocaleString()}</span>
                          )}
                        </div>
                      )}
                      <div className="self-center text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={estimateEditForm.quantity}
                            onChange={(e) =>
                              setEstimateEditForm((prev) => ({ ...prev, quantity: e.target.value }))
                            }
                            className="w-full rounded-lg border border-(--border) bg-white px-2.5 py-2 text-right text-sm tabular-nums text-(--text) focus:border-(--tl-royal) focus:outline-none focus:ring-2 focus:ring-(--tl-royal)/20"
                          />
                        ) : (
                          <span className="text-sm tabular-nums text-(--text)">{item.quantity}</span>
                        )}
                      </div>
                      {!hideClientLineItemPricing && (
                        <div className="self-center text-right">
                          <span className="text-sm font-semibold tabular-nums text-(--tl-navy)">
                            {formatCurrency(isEditing ? previewTotal : item.total)}
                          </span>
                        </div>
                      )}
                      {userRole === "admin" && (
                        <div className="flex shrink-0 items-center justify-end gap-1 self-center">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEstimateItem(item.id)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                title="Save"
                              >
                                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Save
                              </button>
                              <button
                                onClick={cancelEditEstimateItem}
                                className="inline-flex h-8 items-center rounded-lg border border-(--border) px-2.5 text-xs font-semibold text-(--text) transition hover:bg-(--bg)"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditEstimateItem(item)}
                                className="inline-flex h-8 items-center rounded-lg border border-(--border) px-2.5 text-xs font-semibold text-(--text) transition hover:border-(--tl-royal) hover:text-(--tl-royal)"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEstimateItem(item.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-(--text)/40 transition hover:bg-red-50 hover:text-red-500"
                                aria-label="Delete line item"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
                  </div>
                </div>

                {/* Estimate summary — single block, no nested cards */}
                <div className="mt-6 min-w-0 rounded-xl border border-(--border)">
                  {/* Adjustments */}
                  {userRole === "admin" && (
                    <div className="grid grid-cols-1 gap-4 border-b border-(--border) p-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-(--text)/60">Markup</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={markupType}
                            onChange={(e) => setMarkupType(e.target.value as "percentage" | "fixed")}
                            className="rounded-lg border border-(--border) bg-white px-2 py-2 text-sm text-(--tl-navy)"
                          >
                            <option value="percentage">%</option>
                            <option value="fixed">$</option>
                          </select>
                          <input
                            type="number"
                            value={markupValue}
                            onChange={(e) => setMarkupValue(e.target.value)}
                            placeholder="0"
                            step="0.01"
                            min="0"
                            className="min-w-0 flex-1 rounded-lg border border-(--border) bg-white px-3 py-2 text-right text-sm tabular-nums text-(--tl-navy)"
                          />
                        </div>
                        {(parseFloat(markupValue) || 0) > 0 && (
                          <p className="mt-1 text-xs text-(--tl-teal)">+{formatCurrency(getEstimateBreakdown().markup)}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-(--text)/60">Tax (%)</label>
                        <input
                          type="number"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          placeholder="0"
                          step="0.01"
                          min="0"
                          className="w-full rounded-lg border border-(--border) bg-white px-3 py-2 text-right text-sm tabular-nums text-(--tl-navy)"
                        />
                        {(parseFloat(taxRate) || 0) > 0 && (
                          <p className="mt-1 text-xs text-(--tl-teal)">+{formatCurrency(getEstimateBreakdown().tax)}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 flex cursor-pointer items-center justify-between text-xs font-medium text-(--text)/60">
                          <span>Online fee (3.5%)</span>
                          <input
                            type="checkbox"
                            checked={onlineServicingFee}
                            onChange={(e) => setOnlineServicingFee(e.target.checked)}
                            className="h-4 w-4"
                          />
                        </label>
                        <p className="mt-2 text-sm text-(--text)/50">
                          {onlineServicingFee
                            ? `+${formatCurrency(getEstimateBreakdown().servicingFee)}`
                            : "Disabled"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Payment installments */}
                  {userRole === "admin" && (
                    <div className="border-b border-(--border) p-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-(--tl-navy)">Payment Installments</h3>
                          <p className="text-xs text-(--text)/50">
                            {installmentSchedule.reduce((sum, row) => sum + row.percent, 0)}% allocated
                            {installmentSchedule.reduce((sum, row) => sum + row.percent, 0) !== 100 && (
                              <span className="ml-1 text-amber-600">— should total 100%</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={addInstallmentRow}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-(--border) px-4 py-2 text-xs font-semibold text-(--tl-royal) transition hover:bg-(--bg) sm:border-0 sm:px-0 sm:py-0 sm:hover:underline"
                        >
                          + Add milestone
                        </button>
                      </div>

                      {/* Mobile: stacked milestone cards */}
                      <div className="space-y-3 md:hidden">
                        {installmentSchedule.map((item, index) => {
                          const amount = getEstimateBreakdown().total * (item.percent / 100);
                          return (
                            <div
                              key={index}
                              className="space-y-3 rounded-xl border border-(--border) bg-(--bg)/50 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-(--text)/50">
                                  Milestone {index + 1}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => removeInstallmentRow(index)}
                                  className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-(--text)/40 transition hover:bg-red-50 hover:text-red-500"
                                  aria-label="Remove installment"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-(--text)/60">Label</label>
                                <input
                                  value={item.label}
                                  onChange={(e) => updateInstallment(index, "label", e.target.value)}
                                  placeholder="Deposit"
                                  className="w-full rounded-lg border border-(--border) bg-white px-3 py-2.5 text-base"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-(--text)/60">Percent</label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={item.percent}
                                    onChange={(e) => updateInstallment(index, "percent", parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-(--border) bg-white px-3 py-2.5 text-right text-base tabular-nums"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-(--text)/60">Amount</label>
                                  <div className="flex min-h-[46px] items-center justify-end rounded-lg bg-white px-3 py-2.5 text-base font-semibold tabular-nums text-(--tl-navy) ring-1 ring-(--border)">
                                    {formatCurrency(amount)}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-(--text)/60">Due when</label>
                                <input
                                  value={item.due_description}
                                  onChange={(e) => updateInstallment(index, "due_description", e.target.value)}
                                  placeholder="Due on acceptance..."
                                  className="w-full rounded-lg border border-(--border) bg-white px-3 py-2.5 text-base"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop: grid table */}
                      <div className="hidden md:block">
                        <div className="grid grid-cols-[minmax(6rem,1fr)_3.5rem_minmax(0,2fr)_6.5rem_2rem] gap-x-3 gap-y-1 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-(--text)/50">
                          <div>Milestone</div>
                          <div className="text-right">%</div>
                          <div>Due when</div>
                          <div className="text-right">Amount</div>
                          <div />
                        </div>
                        <div className="space-y-1.5">
                          {installmentSchedule.map((item, index) => {
                            const amount = getEstimateBreakdown().total * (item.percent / 100);
                            return (
                              <div
                                key={index}
                                className="grid grid-cols-[minmax(6rem,1fr)_3.5rem_minmax(0,2fr)_6.5rem_2rem] items-center gap-x-3 rounded-lg bg-(--bg)/60 px-1 py-1"
                              >
                                <input
                                  value={item.label}
                                  onChange={(e) => updateInstallment(index, "label", e.target.value)}
                                  placeholder="Deposit"
                                  className="min-w-0 rounded-md border border-(--border) bg-white px-2.5 py-1.5 text-sm"
                                />
                                <input
                                  type="number"
                                  value={item.percent}
                                  onChange={(e) => updateInstallment(index, "percent", parseFloat(e.target.value) || 0)}
                                  className="w-full rounded-md border border-(--border) bg-white px-2 py-1.5 text-right text-sm tabular-nums"
                                />
                                <input
                                  value={item.due_description}
                                  onChange={(e) => updateInstallment(index, "due_description", e.target.value)}
                                  placeholder="Due on acceptance..."
                                  className="min-w-0 rounded-md border border-(--border) bg-white px-2.5 py-1.5 text-sm"
                                />
                                <span className="text-right text-sm font-semibold tabular-nums text-(--tl-navy)">
                                  {formatCurrency(amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeInstallmentRow(index)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-(--text)/40 transition hover:bg-red-50 hover:text-red-500"
                                  aria-label="Remove installment"
                                  title="Remove"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {savingSettings && (
                        <p className="mt-2 text-xs text-(--text)/40">Saving...</p>
                      )}
                    </div>
                  )}

                  {/* Totals */}
                  <div className="divide-y divide-(--border)">
                    {!hideClientLineItemPricing && (
                      <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-(--text)/70">Subtotal</span>
                        <span className="font-medium tabular-nums text-(--text)">{formatCurrency(estimateTotal)}</span>
                      </div>
                    )}
                    {userRole === "admin" && !hideClientMarkup && getEstimateBreakdown().markup > 0 && (
                      <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-(--text)/70">Markup</span>
                        <span className="tabular-nums text-(--tl-teal)">+{formatCurrency(getEstimateBreakdown().markup)}</span>
                      </div>
                    )}
                    {userRole === "admin" && !hideClientMarkup && getEstimateBreakdown().tax > 0 && (
                      <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-(--text)/70">Tax</span>
                        <span className="tabular-nums text-(--tl-teal)">+{formatCurrency(getEstimateBreakdown().tax)}</span>
                      </div>
                    )}
                    {userRole === "admin" && !hideClientMarkup && getEstimateBreakdown().servicingFee > 0 && (
                      <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-(--text)/70">Online servicing fee</span>
                        <span className="tabular-nums text-(--tl-teal)">+{formatCurrency(getEstimateBreakdown().servicingFee)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 bg-(--tl-navy) px-4 py-4 text-white sm:py-3.5">
                      <span className="font-semibold">Estimate Total</span>
                      <span className="text-lg font-bold tabular-nums sm:text-xl">{formatCurrency(getEstimateBreakdown().total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {userRole === "client" && estimateSent && (
            <div className="tl-card p-6">
              <h2 className="text-lg font-semibold text-(--text) mb-2">Project Estimate</h2>
              <p className="text-sm text-(--text)/70 mb-4">
                Your estimate has been prepared. View the full breakdown including payment schedule and terms.
              </p>
              <Link
                href={`/dashboard/projects/${projectId}/estimate`}
                className="inline-flex items-center gap-2 rounded-full bg-(--tl-navy) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--tl-royal)"
              >
                View Estimate
              </Link>
            </div>
          )}

          {/* Photos */}
          <div className="tl-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-(--text)">
                Project Photos ({images.length})
              </h2>
              {canManageImages && (
                <button
                  onClick={() => setShowAddImage(true)}
                  className="tl-btn px-4 py-2 text-sm"
                >
                  + Add Photo
                </button>
              )}
            </div>
            {images.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-(--border) rounded-xl">
                <svg
                  className="w-16 h-16 mx-auto text-(--text)"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-(--text) mt-4">No photos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    onClick={() => setShowImageViewer(image)}
                  className="aspect-square rounded-xl bg-(--bg) overflow-hidden cursor-pointer relative group"
                  >
                    {image.s3_url ? (
                      <Image
                        src={image.s3_url}
                        alt={image.caption || image.filename}
                        fill
                        unoptimized
                        sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <svg
                          className="w-10 h-10 text-(--text)"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-white text-sm font-medium">View</span>
                    </div>
                    <div className="absolute left-0 right-0 bottom-0 bg-black/45 px-2 py-1">
                      <p className="text-xs text-white truncate">{image.filename}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="tl-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-(--text)">
                Tasks ({tasks.length})
              </h2>
              <div className="flex items-center gap-2">
                {userRole === "admin" && (
                  <button
                    onClick={handleGenerateTasks}
                    disabled={generatingTasks}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    {generatingTasks ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        AI Generate
                      </>
                    )}
                  </button>
                )}
                {canCreateTasks && (
                  <button
                    onClick={() => setShowAddTask(true)}
                    className="tl-btn px-4 py-2 text-sm"
                  >
                    + Add Task
                  </button>
                )}
              </div>
            </div>
            {generateError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {generateError}
              </div>
            )}
            {tasks.length === 0 ? (
              <p className="text-center text-(--text) py-8">
                No tasks yet
              </p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-4 rounded-xl transition ${
                      task.is_completed
                        ? "bg-green-50"
                        : "bg-(--bg)"
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTask(task)}
                      disabled={!canManageTasks}
                      className={`mt-0.5 shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                        task.is_completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-(--border) hover:border-(--border)"
                      } ${!canManageTasks ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {task.is_completed && (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          task.is_completed
                            ? "text-green-700 line-through"
                            : "text-(--text)"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-sm text-(--text) mt-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                    {userRole === "admin" && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Team */}
          {userRole !== "employee" && (
            <div className="tl-card p-6">
              <h2 className="text-lg font-semibold text-(--text) mb-4">
                Project Team
              </h2>
              {team.length === 0 ? (
                <p className="text-sm text-(--text)">
                  No team members assigned
                </p>
              ) : (
                <div className="space-y-3">
                  {team.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-(--bg)"
                    >
                      <div className="w-10 h-10 rounded-full bg-(--bg) flex items-center justify-center text-white font-medium">
                        {member.first_name[0]}
                        {member.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-(--text)">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-(--text) capitalize">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <div className="mt-5 pt-5 border-t border-(--border) space-y-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-(--text)">
                    Assign Employees
                  </p>
                  {employeeAssignments.length === 0 ? (
                    <p className="text-sm text-(--text)">No employees assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {employeeAssignments.map((assignment) => (
                        <div
                          key={assignment.user_id}
                          className="flex items-center justify-between rounded-xl border border-(--border) bg-(--bg) px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-(--text)">
                              {assignment.first_name} {assignment.last_name}
                            </p>
                            <p className="text-xs text-(--text)">{assignment.email}</p>
                          </div>
                          <button
                            onClick={() => handleUnassignEmployee(assignment.user_id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {availableEmployees.length > 0 && (
                    <div className="space-y-2">
                      {availableEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between rounded-xl border border-(--border) px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-(--text)">
                              {employee.first_name} {employee.last_name}
                            </p>
                            <p className="text-xs text-(--text)">{employee.email}</p>
                          </div>
                          <button
                            onClick={() => handleAssignEmployee(employee.id)}
                            className="text-xs rounded-full bg-(--bg) px-3 py-1.5 text-(--text) hover:bg-(--bg)/70"
                          >
                            + Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {canSignProject && (
            <div className="tl-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-(--text)">
                  Signatures
                </h2>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-(--bg) p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-(--text)">Admin Approval</p>
                  {adminSignature ? (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-(--text)">{adminSignature.signer_name}</p>
                      <p className="text-xs text-(--text)">{formatDateTime(adminSignature.signed_at)}</p>
                      <Image
                        src={adminSignature.signature_data}
                        alt="Admin signature"
                        width={224}
                        height={56}
                        unoptimized
                        className="mt-2 h-14 rounded border border-(--border) bg-white p-1"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-(--text)">Not signed yet</p>
                  )}
                  {userRole === "admin" && (
                    <button
                      onClick={() => void handleTapProjectSignature()}
                      className="mt-3 text-xs rounded-full border border-(--border) px-3 py-1.5 text-(--text) hover:bg-white"
                    >
                      {adminSignature ? "Re-sign as Admin" : "Sign as Admin"}
                    </button>
                  )}
                </div>

                <div className="rounded-xl bg-(--bg) p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-(--text)">Client Approval</p>
                  {clientSignature ? (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-(--text)">{clientSignature.signer_name}</p>
                      <p className="text-xs text-(--text)">{formatDateTime(clientSignature.signed_at)}</p>
                      <Image
                        src={clientSignature.signature_data}
                        alt="Client signature"
                        width={224}
                        height={56}
                        unoptimized
                        className="mt-2 h-14 rounded border border-(--border) bg-white p-1"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-(--text)">Not signed yet</p>
                  )}
                  {userRole === "client" && (
                    <button
                      onClick={() => void handleTapProjectSignature()}
                      className="mt-3 text-xs rounded-full border border-(--border) px-3 py-1.5 text-(--text) hover:bg-white"
                    >
                      {clientSignature ? "Re-sign as Client" : "Sign as Client"}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-(--text)">
                Signatures reset automatically when project details or estimate line items change.
              </p>
            </div>
          )}

          {/* Invitations */}
          {canEdit && (
            <div className="tl-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-(--text)">
                  Customer Invitations
                </h2>
                <button
                  type="button"
                  onClick={openInviteCustomerModal}
                  className="tl-btn px-3 py-1.5 text-xs"
                >
                  + Invite
                </button>
              </div>
              {invitations.length === 0 ? (
                <p className="text-sm text-(--text)">
                  No invitations sent yet
                </p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl bg-(--bg)"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-(--text) truncate flex-1">
                          {inv.email}
                        </p>
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
                      <p className="text-xs text-(--text) mt-1">
                        Sent {formatDate(inv.created_at)}
                        {inv.inviter_name && ` by ${inv.inviter_name}`}
                      </p>
                      {inv.accepted_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Accepted {formatDate(inv.accepted_at)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Updates */}
          <div className="tl-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-(--text)">
                Updates
              </h2>
              {canAddUpdates && (
                <button
                  onClick={() => setShowAddUpdate(true)}
                  className="tl-btn px-3 py-1.5 text-xs"
                >
                  + Add
                </button>
              )}
            </div>
            {updates.length === 0 ? (
              <p className="text-sm text-(--text)">No updates yet</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="p-3 rounded-xl bg-(--bg)"
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-(--text)">
                        {update.title}
                      </p>
                      <p className="text-xs text-(--text)">
                        {formatDateTime(update.created_at)}
                      </p>
                    </div>
                    {update.content && (
                      <p className="text-sm text-(--text) mt-1">
                        {update.content}
                      </p>
                    )}
                    {update.user_name && (
                      <p className="text-xs text-(--text) mt-2">
                        Posted by {update.user_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowAddTask(false)}>
          <div
            className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Add New Task
            </h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 tl-btn px-4 py-2.5 text-sm"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {/* Add Image Modal */}
      {showAddImage && (
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowAddImage(false)}>
          <div
            className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Add Project Photo
            </h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-(--border) rounded-xl p-8 text-center cursor-pointer hover:border-(--border) transition mb-4"
            >
              <svg
                className="w-12 h-12 mx-auto text-(--text)"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-(--text) mt-2">
                Click to select a photo
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="text-center text-sm text-(--text) mb-4">
              - or add manually -
            </div>
            <form onSubmit={handleAddImage} className="space-y-4">
              <input
                type="text"
                value={newImage.filename}
                onChange={(e) =>
                  setNewImage({ ...newImage, filename: e.target.value })
                }
                required
                placeholder="Filename (e.g., photo.jpg)"
                className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
              />
              <input
                type="text"
                value={newImage.caption}
                onChange={(e) =>
                  setNewImage({ ...newImage, caption: e.target.value })
                }
                placeholder="Caption (optional)"
                className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddImage(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 tl-btn px-4 py-2.5 text-sm"
                >
                  Add Photo
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {/* Add Update Modal */}
      {showAddUpdate && (
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowAddUpdate(false)}>
          <div
            className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Add Project Update
            </h3>
            <form onSubmit={handleAddUpdate} className="space-y-4">
              <input
                type="text"
                value={newUpdate.title}
                onChange={(e) =>
                  setNewUpdate({ ...newUpdate, title: e.target.value })
                }
                required
                placeholder="Update title"
                className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
              />
              <textarea
                value={newUpdate.content}
                onChange={(e) =>
                  setNewUpdate({ ...newUpdate, content: e.target.value })
                }
                rows={4}
                placeholder="Details (optional)"
                className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddUpdate(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 tl-btn px-4 py-2.5 text-sm"
                >
                  Add Update
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {/* Edit Project Modal */}
      {showEditProject && (
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowEditProject(false)}>
          <div
            className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Edit Project
            </h3>
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              {userRole === "admin" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">
                      Budget Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--text)">
                        $
                      </span>
                      <input
                        type="number"
                        value={editForm.budget_amount}
                        onChange={(e) =>
                          setEditForm({ ...editForm, budget_amount: e.target.value })
                        }
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                      />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={editForm.hide_line_item_prices_for_client}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          hide_line_item_prices_for_client: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-5 h-5 rounded"
                    />
                    <span className="text-sm text-(--text)">
                      <span className="font-medium">Hide line-item prices for clients</span>
                      <span className="mt-0.5 block text-xs text-(--text)/60">
                        Also in Estimate Builder — affects email and public links when sent.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={editForm.hide_markup_for_client}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          hide_markup_for_client: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-5 h-5 rounded"
                    />
                    <span className="text-sm text-(--text)">
                      <span className="font-medium">Hide markup details for clients</span>
                      <span className="mt-0.5 block text-xs text-(--text)/60">
                        Clients see grand total and payment schedule without markup/tax/fee lines.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_funded}
                      onChange={(e) =>
                        setEditForm({ ...editForm, is_funded: e.target.checked })
                      }
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm font-medium text-(--text)">
                      Project is funded
                    </span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-(--text) mb-1">
                      Funding Notes
                    </label>
                    <textarea
                      value={editForm.funding_notes}
                      onChange={(e) =>
                        setEditForm({ ...editForm, funding_notes: e.target.value })
                      }
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditProject(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 tl-btn px-4 py-2.5 text-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {/* Invite Customer Modal */}
      {showInviteCustomer && (
        <ModalLayer
          align="center"
          className="bg-black/60"
          onBackdropClick={() => {
            setShowInviteCustomer(false);
            setInviteEmail("");
            setSelectedCrmClientId("");
            setSelectedInviteEmail("");
            setInviteClientSearch("");
          }}
        >
          <div
            className="tl-card w-full max-w-xl rounded-3xl p-4 md:p-6 max-h-[calc(100dvh-2rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Invite Customer
            </h3>
            <p className="text-sm text-(--text) mb-4">
              Choose a client from your CRM directory or add a new profile, then send project access.
            </p>
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setInviteMode("existing")}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                  inviteMode === "existing"
                    ? "bg-(--tl-navy) text-white"
                    : "border border-(--border) text-(--text)"
                }`}
              >
                From directory
              </button>
              <button
                type="button"
                onClick={() => setInviteMode("new")}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${
                  inviteMode === "new"
                    ? "bg-(--tl-navy) text-white"
                    : "border border-(--border) text-(--text)"
                }`}
              >
                Add new client
              </button>
            </div>
            <form onSubmit={handleInviteCustomer} className="space-y-4">
              {inviteMode === "existing" ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    Search active or pending clients
                  </label>
                  <input
                    type="text"
                    value={inviteClientSearch}
                    onChange={(e) => setInviteClientSearch(e.target.value)}
                    placeholder="Search by name, email, active, or pending"
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                  {inviteClientsError && (
                    <p className="text-xs text-red-600">{inviteClientsError}</p>
                  )}
                  {inviteClientsLoading ? (
                    <div className="rounded-xl border border-(--border) bg-(--bg) px-4 py-4 text-sm text-(--text)/70">
                      Loading clients…
                    </div>
                  ) : inviteClientOptions.length === 0 ? (
                    <p className="mt-2 text-xs text-(--text)/60">
                      No clients yet. Add one under Users → Client onboarding, or use Add new client.
                    </p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {inviteClientOptions.map((client) => {
                        const selected =
                          (client.crmClientId && selectedCrmClientId === client.crmClientId) ||
                          (!client.crmClientId && selectedInviteEmail === client.email);
                        return (
                          <button
                            key={client.key}
                            type="button"
                            onClick={() => {
                              setSelectedCrmClientId(client.crmClientId || "");
                              setSelectedInviteEmail(client.crmClientId ? "" : client.email);
                            }}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                              selected
                                ? "border-(--tl-royal) bg-blue-50"
                                : "border-(--border) bg-white hover:bg-(--bg)"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-(--text)">
                                  {client.label}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-(--text)/65">
                                  {client.email}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                  client.status === "active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : client.status === "pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {client.status === "active"
                                  ? "Active"
                                  : client.status === "pending"
                                    ? "Pending"
                                    : "Profile"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <ClientProfileFields value={newClientForm} onChange={setNewClientForm} />
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteCustomer(false);
                    setInviteEmail("");
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
                  {inviteLoading ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {/* Add Estimate Item Modal */}
      {showAddEstimateItem && (
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowAddEstimateItem(false)}>
          <div
            className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Add Estimate Line Item
            </h3>
            <form onSubmit={handleAddEstimateItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Category
                </label>
                <select
                  value={newEstimateItem.category}
                  onChange={(e) =>
                    setNewEstimateItem({ ...newEstimateItem, category: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                >
                  {PREDEFINED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {newEstimateItem.category === "Custom" && (
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    Custom Category Name
                  </label>
                  <input
                    type="text"
                    value={newEstimateItem.customName}
                    onChange={(e) =>
                      setNewEstimateItem({ ...newEstimateItem, customName: e.target.value })
                    }
                    required
                    placeholder="e.g., HVAC, Landscaping..."
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Description
                </label>
                <textarea
                  value={newEstimateItem.description}
                  onChange={(e) =>
                    setNewEstimateItem({ ...newEstimateItem, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Details about this line item..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    Price Rate ($)
                  </label>
                  <input
                    type="number"
                    value={newEstimateItem.priceRate}
                    onChange={(e) =>
                      setNewEstimateItem({ ...newEstimateItem, priceRate: e.target.value })
                    }
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={newEstimateItem.quantity}
                    onChange={(e) =>
                      setNewEstimateItem({ ...newEstimateItem, quantity: e.target.value })
                    }
                    placeholder="1"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  />
                </div>
              </div>
              {/* Preview total */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-(--bg)">
                <span className="text-sm text-(--text)">Line Total:</span>
                <span className="text-lg font-bold text-(--text)">
                  {formatCurrency(
                    (parseFloat(newEstimateItem.priceRate) || 0) *
                    (parseFloat(newEstimateItem.quantity) || 0)
                  )}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddEstimateItem(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 tl-btn px-4 py-2.5 text-sm"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {showSendEstimate && (
        <ModalLayer align="center" className="bg-black/60" onBackdropClick={() => setShowSendEstimate(false)}>
          <div
            className="tl-card w-full max-w-md overflow-hidden rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-(--border)">
              <h3 className="text-lg font-semibold text-(--text)">Send Estimate to Client</h3>
              <p className="text-sm text-(--text)/70 mt-1">
                Sends a full estimate breakdown by email. Recipients don&apos;t need a CRM account — pending invites work too.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {sendRecipientsLoading ? (
                <div className="rounded-xl border border-(--border) bg-(--bg) p-4 text-sm text-(--text)/70">
                  Loading client recipients...
                </div>
              ) : sendRecipientsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {sendRecipientsError}
                </div>
              ) : sendRecipients.length === 0 ? (
                <div className="rounded-xl border border-(--border) bg-(--bg) p-4">
                  <p className="text-sm text-(--text)/70">
                    No clients or pending invitations are attached to this project yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendEstimate(false);
                    setTimeout(() => {
                      void openInviteCustomerModal();
                    }, 0);
                    }}
                    className="mt-3 rounded-full bg-(--tl-navy) px-4 py-2 text-xs font-semibold text-white hover:bg-(--tl-royal)"
                  >
                    Invite or add client
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-(--text)">Recipient</label>
                  <select
                    value={selectedRecipientEmail}
                    onChange={(e) => setSelectedRecipientEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-(--border) px-3 py-2 text-sm"
                  >
                    <option value="">Select recipient...</option>
                    {sendRecipients.map((recipient) => (
                      <option key={recipient.email} value={recipient.email}>
                        {recipient.name !== recipient.email ? `${recipient.name} (${recipient.email})` : recipient.email}
                        {recipient.status === "invited" ? " — invite pending" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="rounded-xl bg-(--bg) p-4">
                <p className="text-xs uppercase tracking-wider text-(--text)/60">Total to send</p>
                <p className="text-2xl font-bold text-(--tl-navy)">{formatCurrency(getEstimateBreakdown().total)}</p>
                {(project.hide_line_item_prices_for_client || project.hide_markup_for_client) && (
                  <p className="mt-2 text-xs text-(--text)/60">
                    Client will see{" "}
                    {project.hide_line_item_prices_for_client && project.hide_markup_for_client
                      ? "scope, total, and payment schedule only."
                      : project.hide_line_item_prices_for_client
                        ? "line items without per-line pricing."
                        : "line-item prices without markup/tax/fee breakdown."}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSendEstimate(false)}
                  className="flex-1 rounded-full border border-(--border) px-4 py-2.5 text-sm font-medium text-(--text)"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendEstimate}
                  disabled={sendRecipientsLoading || sendingEstimate || !selectedRecipientEmail}
                  className="flex-1 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {sendingEstimate ? "Sending..." : "Send Estimate"}
                </button>
              </div>
            </div>
          </div>
        </ModalLayer>
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <ModalLayer align="sheet" className="bg-black/80" onBackdropClick={() => setShowImageViewer(null)}>
          <div
            className="tl-card w-full max-w-3xl overflow-hidden rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-(--border) flex items-center justify-between">
              <div>
                <p className="font-medium text-(--text)">
                  {showImageViewer.filename}
                </p>
                {showImageViewer.caption && (
                  <p className="text-sm text-(--text)">
                    {showImageViewer.caption}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowImageViewer(null)}
                className="p-2 rounded-lg hover:bg-(--bg)"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="aspect-video bg-(--bg) flex items-center justify-center">
              {showImageViewer.s3_url ? (
                <Image
                  src={showImageViewer.s3_url}
                  alt={showImageViewer.caption || showImageViewer.filename}
                  width={1600}
                  height={900}
                  unoptimized
                  className="h-full w-full object-contain bg-black"
                />
              ) : (
                <div className="text-center">
                  <svg
                    className="w-24 h-24 mx-auto text-(--text)"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-(--text) mt-4">
                    Image preview unavailable
                  </p>
                  <p className="text-xs text-(--text)">
                    Missing image URL
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 flex items-center justify-between border-t border-(--border)">
              <div className="text-xs text-(--text)">
                {showImageViewer.uploader_name && (
                  <span>Uploaded by {showImageViewer.uploader_name} / </span>
                )}
                {formatDate(showImageViewer.created_at)}
              </div>
              {userRole === "admin" && (
                <button
                  onClick={() => handleDeleteImage(showImageViewer.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete Photo
                </button>
              )}
            </div>
          </div>
        </ModalLayer>
      )}

    </div>
  );
}
