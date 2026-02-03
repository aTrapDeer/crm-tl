"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  is_funded: boolean;
  funding_notes: string | null;
  on_hold_reason: string | null;
  expected_resume_date: string | null;
  created_at: string;
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
}

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
  const PREDEFINED_CATEGORIES = [
    "Demo", "Carpentry", "Electrical", "Plumbing", "Drywall/Mud/Taping", "Coatings", "Custom",
  ];
  const [markupType, setMarkupType] = useState<"percentage" | "fixed">("percentage");
  const [markupValue, setMarkupValue] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [onlineServicingFee, setOnlineServicingFee] = useState(true);

  function getEstimateBreakdown() {
    const subtotal = estimateTotal;
    const markup = markupType === "percentage"
      ? subtotal * ((parseFloat(markupValue) || 0) / 100)
      : (parseFloat(markupValue) || 0);
    const afterMarkup = subtotal + markup;
    const tax = afterMarkup * ((parseFloat(taxRate) || 0) / 100);
    const afterTax = afterMarkup + tax;
    const servicingFee = onlineServicingFee ? afterTax * 0.035 : 0;
    const total = afterTax + servicingFee;
    return { subtotal, markup, afterMarkup, tax, afterTax, servicingFee, total };
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
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [editForm, setEditForm] = useState({
    status: "",
    budget_amount: "",
    is_funded: false,
    funding_notes: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = currentUser?.role || "client";
  const canManageTasks = userRole === "admin" || userRole === "employee";
  const canManageImages = userRole === "admin" || userRole === "employee";
  const canEdit = userRole === "admin" || userRole === "employee";

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
      setCurrentUser(sessionData.user);

      setEditForm({
        status: projectData.project.status,
        budget_amount: projectData.project.budget_amount?.toString() || "",
        is_funded: projectData.project.is_funded,
        funding_notes: projectData.project.funding_notes || "",
      });

      // Fetch related data
      const [tasksRes, teamRes, imagesRes, updatesRes, invitationsRes, estimateRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/team`),
        fetch(`/api/projects/${projectId}/images`),
        fetch(`/api/projects/${projectId}/updates`),
        sessionData.user?.role !== "client"
          ? fetch(`/api/projects/${projectId}/invitations`)
          : Promise.resolve({ json: () => Promise.resolve({ invitations: [] }) }),
        fetch(`/api/projects/${projectId}/estimate`),
      ]);

      const tasksData = await tasksRes.json();
      const teamData = await teamRes.json();
      const imagesData = await imagesRes.json();
      const updatesData = await updatesRes.json();
      const invitationsData = await invitationsRes.json();
      const estimateData = await estimateRes.json();

      setTasks(tasksData.tasks || []);
      setStats(tasksData.stats || { total: 0, completed: 0 });
      setTeam(teamData.team || []);
      setImages(imagesData.images || []);
      setUpdates(updatesData.updates || []);
      setInvitations(invitationsData.invitations || []);
      setEstimateItems(estimateData.items || []);
      setEstimateTotal(estimateData.total || 0);
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

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
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
      }
    } catch (error) {
      console.error("Failed to delete estimate item:", error);
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

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editForm.status,
          budget_amount: editForm.budget_amount
            ? parseFloat(editForm.budget_amount)
            : null,
          is_funded: editForm.is_funded,
          funding_notes: editForm.funding_notes || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setShowEditProject(false);
      }
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  }

  async function handleInviteCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setInvitations((prev) => [data.invitation, ...prev]);
        setInviteEmail("");
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

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-(--text)">
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
          {project.description && (
            <p className="text-(--text) mt-2 max-w-2xl">
              {project.description}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowEditProject(true)}
            className="tl-btn px-5 py-2.5 text-sm"
          >
            Edit Project
          </button>
        )}
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
          <div className="tl-card p-6">
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
              {project.start_date && (
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
          <div className="tl-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-(--text)">
                Estimate Builder
              </h2>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold text-(--text)">
                  {formatCurrency(estimateTotal)}
                </p>
                {userRole === "admin" && (
                  <button
                    onClick={() => setShowAddEstimateItem(true)}
                    className="tl-btn px-4 py-2 text-sm"
                  >
                    + Add Item
                  </button>
                )}
              </div>
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
              <div className="space-y-2">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold text-(--text) uppercase tracking-wider">
                  <div className="col-span-3">Category</div>
                  <div className="col-span-4">Description</div>
                  <div className="col-span-1 text-right">Rate</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2 text-right">Total</div>
                  {userRole === "admin" && <div className="col-span-1"></div>}
                </div>
                {estimateItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-3 p-4 rounded-xl bg-(--bg) items-center"
                  >
                    <div className="md:col-span-3">
                      <span className="md:hidden text-xs font-semibold text-(--text) uppercase">Category: </span>
                      <span className="font-medium text-(--text)">
                        {item.category === "custom" ? item.custom_category_name || "Custom" : item.category}
                      </span>
                    </div>
                    <div className="md:col-span-4">
                      <p className="text-sm text-(--text) line-clamp-2">
                        {item.description || "No description"}
                      </p>
                    </div>
                    <div className="md:col-span-1 md:text-right">
                      <span className="md:hidden text-xs font-semibold text-(--text)">Rate: </span>
                      <span className="text-sm text-(--text)">${item.price_rate.toLocaleString()}</span>
                    </div>
                    <div className="md:col-span-1 md:text-right">
                      <span className="md:hidden text-xs font-semibold text-(--text)">Qty: </span>
                      <span className="text-sm text-(--text)">{item.quantity}</span>
                    </div>
                    <div className="md:col-span-2 md:text-right">
                      <span className="md:hidden text-xs font-semibold text-(--text)">Total: </span>
                      <span className="font-semibold text-(--text)">{formatCurrency(item.total)}</span>
                    </div>
                    {userRole === "admin" && (
                      <div className="md:col-span-1 text-right">
                        <button
                          onClick={() => handleDeleteEstimateItem(item.id)}
                          className="text-red-400 hover:text-red-600 transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {/* Subtotal */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-(--tl-sand)">
                  <p className="text-sm font-semibold text-(--tl-navy)">Subtotal</p>
                  <p className="text-lg font-bold text-(--tl-navy)">{formatCurrency(estimateTotal)}</p>
                </div>

                {/* Markup, Tax, Fee - Admin only */}
                {userRole === "admin" && (
                  <>
                    <div className="p-3 rounded-xl border border-(--tl-slate-300) space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-(--tl-navy)">Markup</p>
                        <div className="flex items-center gap-2">
                          <select
                            value={markupType}
                            onChange={(e) => setMarkupType(e.target.value as "percentage" | "fixed")}
                            className="text-xs px-2 py-1 rounded-lg border border-(--border) bg-white text-(--tl-navy)"
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
                            className="w-20 text-right text-sm px-2 py-1 rounded-lg border border-(--border) bg-white text-(--tl-navy)"
                          />
                        </div>
                      </div>
                      {(parseFloat(markupValue) || 0) > 0 && (
                        <p className="text-xs text-right text-(--tl-teal)">
                          +{formatCurrency(getEstimateBreakdown().markup)}
                        </p>
                      )}
                    </div>

                    <div className="p-3 rounded-xl border border-(--tl-slate-300) space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-(--tl-navy)">Tax (%)</p>
                        <input
                          type="number"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          placeholder="0"
                          step="0.01"
                          min="0"
                          className="w-20 text-right text-sm px-2 py-1 rounded-lg border border-(--border) bg-white text-(--tl-navy)"
                        />
                      </div>
                      {(parseFloat(taxRate) || 0) > 0 && (
                        <p className="text-xs text-right text-(--tl-teal)">
                          +{formatCurrency(getEstimateBreakdown().tax)}
                        </p>
                      )}
                    </div>

                    <div className="p-3 rounded-xl border border-(--tl-slate-300)">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm font-medium text-(--tl-navy)">Online Servicing Fee (3.5%)</span>
                        <input
                          type="checkbox"
                          checked={onlineServicingFee}
                          onChange={(e) => setOnlineServicingFee(e.target.checked)}
                          className="h-4 w-4"
                        />
                      </label>
                      {onlineServicingFee && getEstimateBreakdown().servicingFee > 0 && (
                        <p className="text-xs text-right text-(--tl-teal) mt-1">
                          +{formatCurrency(getEstimateBreakdown().servicingFee)}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Grand Total */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-900 text-white">
                  <p className="font-semibold">Estimate Total</p>
                  <p className="text-2xl font-bold">
                    {userRole === "admin"
                      ? formatCurrency(getEstimateBreakdown().total)
                      : formatCurrency(estimateTotal)}
                  </p>
                </div>
              </div>
            )}
          </div>

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
                      <p className="text-xs text-(--text) text-center truncate w-full mt-2">
                        {image.filename}
                      </p>
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-white text-sm font-medium">View</span>
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
                {canManageTasks && (
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
          </div>

          {/* Invitations */}
          {canEdit && (
            <div className="tl-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-(--text)">
                  Customer Invitations
                </h2>
                <button
                  onClick={() => setShowInviteCustomer(true)}
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
              {canEdit && (
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
                        - {update.user_name}
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
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
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
        </div>
      )}

      {/* Add Image Modal */}
      {showAddImage && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
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
        </div>
      )}

      {/* Add Update Modal */}
      {showAddUpdate && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
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
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProject && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Edit Project
            </h3>
            <form onSubmit={handleUpdateProject} className="space-y-4">
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
        </div>
      )}

      {/* Invite Customer Modal */}
      {showInviteCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Invite Customer
            </h3>
            <p className="text-sm text-(--text) mb-4">
              Send an invitation to a customer to give them view access to this project.
            </p>
            <form onSubmit={handleInviteCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="customer@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                />
              </div>
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
        </div>
      )}

      {/* Add Estimate Item Modal */}
      {showAddEstimateItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
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
        </div>
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="tl-card w-full max-w-3xl overflow-hidden rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh]">
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
                  S3 not configured
                </p>
              </div>
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
        </div>
      )}
    </div>
  );
}
