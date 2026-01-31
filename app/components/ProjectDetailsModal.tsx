"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  inviter_name?: string;
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

interface EstimateLineItem {
  id: string;
  category: string;
  custom_category_name: string | null;
  description: string | null;
  price_rate: number;
  quantity: number;
  total: number;
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

interface ProjectDetailsModalProps {
  project: Project;
  onClose: () => void;
  userRole: "admin" | "employee" | "client";
  onProjectUpdate?: (project: Project) => void;
}

export default function ProjectDetailsModal({
  project,
  onClose,
  userRole,
  onProjectUpdate,
}: ProjectDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({ total: 0, completed: 0 });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditBudget, setShowEditBudget] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<ProjectImage | null>(null);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [newImage, setNewImage] = useState({ filename: "", caption: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [budgetForm, setBudgetForm] = useState({
    budget_amount: project.budget_amount?.toString() || "",
    is_funded: project.is_funded,
    funding_notes: project.funding_notes || "",
  });
  const [projectForm, setProjectForm] = useState({
    name: project.name,
    description: project.description || "",
    address: project.address || "",
    start_date: project.start_date || "",
    end_date: project.end_date || "",
  });

  // Status change state
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showOnHoldModal, setShowOnHoldModal] = useState(false);
  const [onHoldForm, setOnHoldForm] = useState({
    reason: "",
    expectedResumeDate: "",
  });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Invite client state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteError, setInviteError] = useState("");

  // Estimate builder state
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

  // AI task generation state
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const PREDEFINED_CATEGORIES = [
    "Demo",
    "Carpentry",
    "Electrical",
    "Plumbing",
    "Drywall/Mud/Taping",
    "Coatings",
    "Custom",
  ];

  // Change request state (for clients)
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [changeRequestSections, setChangeRequestSections] = useState<string[]>([]);
  const [changeRequestMessage, setChangeRequestMessage] = useState("");
  const [submittingChangeRequest, setSubmittingChangeRequest] = useState(false);
  const [changeRequestSuccess, setChangeRequestSuccess] = useState("");
  const [changeRequestError, setChangeRequestError] = useState("");

  // Portal mounting
  useEffect(() => {
    setMounted(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const canManageTasks = userRole === "admin" || userRole === "employee";
  const canManageImages = userRole === "admin" || userRole === "employee";
  const canEditBudget = userRole === "admin";
  const canChangeStatus = userRole === "admin" || userRole === "employee";
  const canInviteClients = userRole === "admin" || userRole === "employee";
  const changeRequestOptions = [
    { id: "name", label: "Project name" },
    { id: "description", label: "Description" },
    { id: "address", label: "Address" },
    { id: "start_date", label: "Start date" },
    { id: "end_date", label: "End date" },
    { id: "budget", label: "Budget & funding" },
    { id: "status", label: "Project status" },
  ];

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, teamRes, imagesRes, estimateRes] = await Promise.all([
        fetch(`/api/projects/${project.id}/tasks`),
        fetch(`/api/projects/${project.id}/team`),
        fetch(`/api/projects/${project.id}/images`),
        fetch(`/api/projects/${project.id}/estimate`),
      ]);

      const tasksData = await tasksRes.json();
      const teamData = await teamRes.json();
      const imagesData = await imagesRes.json();
      const estimateData = await estimateRes.json();

      setTasks(tasksData.tasks || []);
      setStats(tasksData.stats || { total: 0, completed: 0 });
      setTeam(teamData.team || []);
      setImages(imagesData.images || []);
      setEstimateItems(estimateData.items || []);
      setEstimateTotal(estimateData.total || 0);
    } catch (error) {
      console.error("Failed to fetch project details:", error);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
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
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
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
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (res.ok) {
        const data = await res.json();
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  }

  async function handleUpdateBudget(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget_amount: budgetForm.budget_amount
            ? parseFloat(budgetForm.budget_amount)
            : null,
          is_funded: budgetForm.is_funded,
          funding_notes: budgetForm.funding_notes || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowEditBudget(false);
        if (onProjectUpdate) {
          onProjectUpdate(data.project);
        }
      }
    } catch (error) {
      console.error("Failed to update budget:", error);
    }
  }

  async function handleAddEstimateItem(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${project.id}/estimate`, {
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
        setNewEstimateItem({
          category: "Demo",
          customName: "",
          description: "",
          priceRate: "",
          quantity: "1",
        });
        // Update the project budget to match estimate total
        await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` }),
        });
        if (onProjectUpdate) {
          onProjectUpdate({ ...project, budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` });
        }
      }
    } catch (error) {
      console.error("Failed to add estimate item:", error);
    }
  }

  async function handleDeleteEstimateItem(itemId: string) {
    try {
      const res = await fetch(`/api/projects/${project.id}/estimate`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

      if (res.ok) {
        const data = await res.json();
        setEstimateItems((prev) => prev.filter((item) => item.id !== itemId));
        setEstimateTotal(data.total);
        // Update the project budget
        await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` }),
        });
        if (onProjectUpdate) {
          onProjectUpdate({ ...project, budget_amount: data.total, funding_notes: `Estimate Total: $${data.total.toLocaleString()}` });
        }
      }
    } catch (error) {
      console.error("Failed to delete estimate item:", error);
    }
  }

  async function handleGenerateTasks() {
    setGeneratingTasks(true);
    setGenerateError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/generate-tasks`, {
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

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectForm.name,
          description: projectForm.description || null,
          address: projectForm.address || null,
          start_date: projectForm.start_date || null,
          end_date: projectForm.end_date || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowEditProject(false);
        if (onProjectUpdate) {
          onProjectUpdate(data.project);
        }
      }
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  }

  async function handleAddImage(e: React.FormEvent) {
    e.preventDefault();
    if (!newImage.filename.trim()) return;

    setUploadingImage(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/images`, {
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
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", newImage.caption || "");

      const res = await fetch(`/api/projects/${project.id}/images`, {
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
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (userRole !== "admin") return;

    try {
      const res = await fetch(`/api/projects/${project.id}/images`, {
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

  async function handleStatusChange(newStatus: string) {
    if (!canChangeStatus) return;

    // If changing to on_hold, show the on-hold modal first
    if (newStatus === "on_hold") {
      setShowOnHoldModal(true);
      setShowStatusChange(false);
      return;
    }

    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        if (onProjectUpdate) {
          onProjectUpdate(data.project);
        }
        setShowStatusChange(false);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleOnHoldSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onHoldForm.reason.trim()) return;

    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "on_hold",
          on_hold_reason: onHoldForm.reason,
          expected_resume_date: onHoldForm.expectedResumeDate || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (onProjectUpdate) {
          onProjectUpdate(data.project);
        }
        setShowOnHoldModal(false);
        setOnHoldForm({ reason: "", expectedResumeDate: "" });
      }
    } catch (error) {
      console.error("Failed to put project on hold:", error);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function fetchInvitations() {
    try {
      const res = await fetch(`/api/projects/${project.id}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
    }
  }

  async function handleSubmitChangeRequest(e: React.FormEvent) {
    e.preventDefault();
    if (changeRequestSections.length === 0) return;

    setSubmittingChangeRequest(true);
    setChangeRequestError("");
    setChangeRequestSuccess("");

    try {
      const res = await fetch(`/api/projects/${project.id}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: changeRequestSections,
          message: changeRequestMessage || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setChangeRequestSuccess("Your change request has been submitted. You will be notified once an admin reviews it.");
        setChangeRequestSections([]);
        setChangeRequestMessage("");
      } else {
        setChangeRequestError(data.error || "Failed to submit change request");
      }
    } catch (error) {
      console.error("Failed to submit change request:", error);
      setChangeRequestError("Failed to submit change request");
    } finally {
      setSubmittingChangeRequest(false);
    }
  }

  function toggleChangeRequestSection(section: string) {
    setChangeRequestSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  }

  async function handleInviteClient(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSendingInvite(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const res = await fetch(`/api/projects/${project.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setInviteSuccess(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        fetchInvitations();
      } else {
        setInviteError(data.error || "Failed to send invitation");
      }
    } catch (error) {
      console.error("Failed to invite client:", error);
      setInviteError("Failed to send invitation");
    } finally {
      setSendingInvite(false);
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

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Don't render until mounted (for portal)
  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-9999 p-0 md:p-4">
      <div className="tl-card w-full max-w-3xl h-svh md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col rounded-none md:rounded-3xl shadow-2xl">
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 bg-white">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-4 pb-4 pt-2 md:p-6 border-b border-(--border) bg-white">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                <h2 className="text-base md:text-xl font-semibold text-(--text) line-clamp-2 md:truncate md:max-w-none">
                  {project.name}
                </h2>
                {canChangeStatus ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowStatusChange(!showStatusChange)}
                      disabled={updatingStatus}
                      className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition hover:ring-2 hover:ring-(--ring)/50 ${
                        statusColors[project.status] || statusColors.planning
                      } ${updatingStatus ? "opacity-50" : ""}`}
                    >
                      {statusLabels[project.status] || project.status}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showStatusChange && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-(--border) rounded-xl shadow-lg z-10 py-1 min-w-[140px]">
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <button
                            key={value}
                            onClick={() => handleStatusChange(value)}
                            disabled={value === project.status}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-(--bg) transition ${
                              value === project.status ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                              value === "planning" ? "bg-gray-400" :
                              value === "in_progress" ? "bg-blue-500" :
                              value === "on_hold" ? "bg-yellow-500" :
                              "bg-green-500"
                            }`} />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                      statusColors[project.status] || statusColors.planning
                    }`}
                  >
                    {statusLabels[project.status] || project.status}
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-sm text-(--text)">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-2 ml-2 md:ml-4 shrink-0">
              {userRole === "admin" && (
                <button
                  onClick={() => setShowEditProject(true)}
                  className="p-2 hover:bg-(--bg) rounded-full transition"
                  title="Edit project details"
                >
                  <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {canInviteClients && (
                <button
                  onClick={() => {
                    setShowInviteModal(true);
                    fetchInvitations();
                  }}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-(--bg) text-white hover:bg-(--bg) transition"
                  title="Invite Client"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Invite Client
                </button>
              )}
              {userRole === "client" && (
                <button
                  onClick={() => {
                    setShowChangeRequestModal(true);
                    setChangeRequestError("");
                    setChangeRequestSuccess("");
                  }}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-(--border) text-(--text) hover:bg-(--bg) transition"
                  title="Request Changes"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4h2a2 2 0 012 2v2m-2 12h-2a2 2 0 01-2-2v-2m-6 6H6a2 2 0 01-2-2v-2m2-12h2a2 2 0 012 2v2" />
                  </svg>
                  Request Changes
                </button>
              )}
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="hidden md:flex p-2 rounded-lg hover:bg-(--bg) transition"
                title="Open full page"
              >
                <svg
                  className="w-5 h-5 text-(--text)"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </Link>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-gray-100 md:bg-transparent hover:bg-gray-200 md:hover:bg-(--bg) transition"
              >
                <svg
                  className="w-5 h-5 text-(--text) md:text-(--text)"
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
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--border)" />
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {/* On Hold Alert */}
              {project.status === "on_hold" && (
                <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-yellow-800">Project On Hold</h4>
                      {project.on_hold_reason && (
                        <p className="text-sm text-yellow-700 mt-1">
                          <span className="font-medium">Reason:</span> {project.on_hold_reason}
                        </p>
                      )}
                      {project.expected_resume_date && (
                        <p className="text-sm text-yellow-700 mt-1">
                          <span className="font-medium">Expected to resume:</span> {formatDate(project.expected_resume_date)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div className="p-4 rounded-xl bg-(--bg)">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-(--text)">
                    Task Progress
                  </span>
                  <span className="text-sm text-(--text)">
                    {stats.completed} / {stats.total} tasks
                  </span>
                </div>
                <div className="h-3 bg-(--bg) rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-(--tl-cyan) to-(--tl-royal) transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-(--text) mt-2 text-right">
                  {progressPercent}% complete
                </p>
              </div>

              {/* Estimate Builder */}
              <div className="p-3 md:p-4 rounded-xl border border-(--border)">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-(--text)">
                    Estimate Builder
                  </h3>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-(--text)">
                      {formatCurrency(estimateTotal)}
                    </p>
                    {canEditBudget && (
                      <button
                        onClick={() => setShowAddEstimateItem(true)}
                        className="tl-btn px-2 md:px-3 py-1.5 text-xs"
                      >
                        + Add Item
                      </button>
                    )}
                  </div>
                </div>

                {estimateItems.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-(--border) rounded-xl">
                    <svg className="w-10 h-10 mx-auto text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-(--text) mt-2">No estimate items yet</p>
                    {canEditBudget && (
                      <p className="text-xs text-(--text)">Add line items to build the project estimate</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-1 text-xs font-semibold text-(--text) uppercase tracking-wider">
                      <div className="col-span-3">Category</div>
                      <div className="col-span-4">Description</div>
                      <div className="col-span-1 text-right">Rate</div>
                      <div className="col-span-1 text-right">Qty</div>
                      <div className="col-span-2 text-right">Total</div>
                      {canEditBudget && <div className="col-span-1"></div>}
                    </div>
                    {estimateItems.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-2 p-3 rounded-lg bg-(--bg) items-center"
                      >
                        <div className="md:col-span-3">
                          <span className="md:hidden text-xs font-semibold text-(--text) uppercase">Category: </span>
                          <span className="text-sm font-medium text-(--text)">
                            {item.category === "custom" ? item.custom_category_name || "Custom" : item.category}
                          </span>
                        </div>
                        <div className="md:col-span-4">
                          <p className="text-xs text-(--text) line-clamp-2">
                            {item.description || "No description"}
                          </p>
                        </div>
                        <div className="md:col-span-1 md:text-right">
                          <span className="md:hidden text-xs font-semibold text-(--text)">Rate: </span>
                          <span className="text-sm text-(--text)">
                            ${item.price_rate.toLocaleString()}
                          </span>
                        </div>
                        <div className="md:col-span-1 md:text-right">
                          <span className="md:hidden text-xs font-semibold text-(--text)">Qty: </span>
                          <span className="text-sm text-(--text)">{item.quantity}</span>
                        </div>
                        <div className="md:col-span-2 md:text-right">
                          <span className="md:hidden text-xs font-semibold text-(--text)">Total: </span>
                          <span className="text-sm font-semibold text-(--text)">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                        {canEditBudget && (
                          <div className="md:col-span-1 text-right">
                            <button
                              onClick={() => handleDeleteEstimateItem(item.id)}
                              className="text-red-400 hover:text-red-600 transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Grand Total */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-900 text-white">
                      <p className="text-sm font-semibold">Estimate Total</p>
                      <p className="text-xl font-bold">{formatCurrency(estimateTotal)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {project.address && (
                  <div className="p-3 rounded-xl bg-(--bg)">
                    <p className="text-xs uppercase tracking-wider text-(--text)">
                      Location
                    </p>
                    <p className="text-sm font-medium text-(--text) mt-1">
                      {project.address}
                    </p>
                  </div>
                )}
                {project.start_date && (
                  <div className="p-3 rounded-xl bg-(--bg)">
                    <p className="text-xs uppercase tracking-wider text-(--text)">
                      Start Date
                    </p>
                    <p className="text-sm font-medium text-(--text) mt-1">
                      {formatDate(project.start_date)}
                    </p>
                  </div>
                )}
              </div>

              {/* Project Photos */}
              <div className="p-3 md:p-4 rounded-xl border border-(--border)">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-sm font-semibold text-(--text)">
                    Project Photos ({images.length})
                  </h3>
                  {canManageImages && (
                    <button
                      onClick={() => setShowAddImage(true)}
                      className="tl-btn px-2 md:px-3 py-1.5 text-xs"
                    >
                      + Add Photo
                    </button>
                  )}
                </div>
                {images.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-(--border) rounded-xl">
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
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm text-(--text) mt-2">
                      No photos yet
                    </p>
                    <p className="text-xs text-(--text)">
                      {canManageImages
                        ? "Add photos to document project progress"
                        : "Photos will appear here once added"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => setShowImageViewer(image)}
                        className="aspect-square rounded-lg bg-(--bg) overflow-hidden cursor-pointer relative group"
                      >
                        {/* Placeholder - would show actual image when S3 is configured */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                          <svg
                            className="w-8 h-8 text-(--text)"
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
                          <p className="text-xs text-(--text) text-center truncate w-full mt-1">
                            {image.filename}
                          </p>
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="text-white text-xs">View</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Members */}
              <div className="p-3 md:p-4 rounded-xl border border-(--border)">
                <h3 className="text-sm font-semibold text-(--text) mb-3">
                  Project Team
                </h3>
                {team.length === 0 ? (
                  <p className="text-sm text-(--text)">
                    No team members assigned yet
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {team.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-(--bg)"
                      >
                        <div className="w-8 h-8 rounded-full bg-(--bg) flex items-center justify-center text-white text-xs font-medium">
                          {member.first_name[0]}
                          {member.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-(--text)">
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

              {/* Tasks */}
              <div className="p-3 md:p-4 rounded-xl border border-(--border)">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-sm font-semibold text-(--text)">
                    Tasks
                  </h3>
                  <div className="flex items-center gap-2">
                    {userRole === "admin" && (
                      <button
                        onClick={handleGenerateTasks}
                        disabled={generatingTasks}
                        className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
                      >
                        {generatingTasks ? (
                          <>
                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        className="tl-btn px-2 md:px-3 py-1.5 text-xs"
                      >
                        + Add Task
                      </button>
                    )}
                  </div>
                </div>
                {generateError && (
                  <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    {generateError}
                  </div>
                )}
                {tasks.length === 0 ? (
                  <p className="text-sm text-(--text) text-center py-4">
                    No tasks yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 p-3 rounded-lg transition ${
                          task.is_completed
                            ? "bg-green-50"
                            : "bg-(--bg)"
                        }`}
                      >
                        <button
                          onClick={() => handleToggleTask(task)}
                          disabled={!canManageTasks}
                          className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                            task.is_completed
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-(--border) hover:border-(--border)"
                          } ${!canManageTasks ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          {task.is_completed && (
                            <svg
                              className="w-3 h-3"
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
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              task.is_completed
                                ? "text-green-700 line-through"
                                : "text-(--text)"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-(--text) mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                        {userRole === "admin" && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-red-400 hover:text-red-600 transition"
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
          )}
        </div>

        {/* Mobile Action Bar */}
        <div className="md:hidden flex items-center gap-2 p-4 border-t border-(--border) bg-white">
          {userRole === "client" && (
            <button
              onClick={() => {
                setShowChangeRequestModal(true);
                setChangeRequestError("");
                setChangeRequestSuccess("");
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl border-2 border-(--border) text-(--text) active:bg-(--bg) transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 4h2a2 2 0 012 2v2m-2 12h-2a2 2 0 01-2-2v-2m-6 6H6a2 2 0 01-2-2v-2m2-12h2a2 2 0 012 2v2" />
              </svg>
              Request Changes
            </button>
          )}
          {canInviteClients && (
            <button
              onClick={() => {
                setShowInviteModal(true);
                fetchInvitations();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-(--bg) text-white active:bg-(--bg) transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invite Client
            </button>
          )}
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl border-2 border-(--border) text-(--text) active:bg-(--bg) transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Full Page
          </Link>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
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
                  placeholder="e.g., Complete foundation work"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
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
                  placeholder="Additional details..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
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

      {/* Edit Budget Modal */}
      {showEditBudget && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Edit Budget & Funding
            </h3>
            <form onSubmit={handleUpdateBudget} className="space-y-4">
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
                    value={budgetForm.budget_amount}
                    onChange={(e) =>
                      setBudgetForm({
                        ...budgetForm,
                        budget_amount: e.target.value,
                      })
                    }
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={budgetForm.is_funded}
                    onChange={(e) =>
                      setBudgetForm({
                        ...budgetForm,
                        is_funded: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded border-(--border) text-(--text) focus:ring-(--ring)"
                  />
                  <span className="text-sm font-medium text-(--text)">
                    Project is funded
                  </span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Funding Notes
                </label>
                <textarea
                  value={budgetForm.funding_notes}
                  onChange={(e) =>
                    setBudgetForm({
                      ...budgetForm,
                      funding_notes: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Notes about funding status, payment terms, etc."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditBudget(false)}
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

      {/* Add Estimate Item Modal */}
      {showAddEstimateItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
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

      {/* Add Image Modal */}
      {showAddImage && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4 overflow-y-auto">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-(--text) mb-4">
              Add Project Photo
            </h3>
            
            {/* File Upload Area */}
            <div className="mb-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-(--border) rounded-xl p-8 text-center cursor-pointer hover:border-(--border) transition"
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
                <p className="text-xs text-(--text)">
                  (S3 not configured - file won&apos;t actually upload)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="text-center text-sm text-(--text) mb-4">
              - or add manually -
            </div>

            <form onSubmit={handleAddImage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Filename
                </label>
                <input
                  type="text"
                  value={newImage.filename}
                  onChange={(e) =>
                    setNewImage({ ...newImage, filename: e.target.value })
                  }
                  required
                  placeholder="e.g., foundation-complete.jpg"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Caption (optional)
                </label>
                <input
                  type="text"
                  value={newImage.caption}
                  onChange={(e) =>
                    setNewImage({ ...newImage, caption: e.target.value })
                  }
                  placeholder="Describe this photo..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
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
                  disabled={uploadingImage}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {uploadingImage ? "Adding..." : "Add Photo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
          <div className="tl-card w-full max-w-2xl overflow-hidden rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh]">
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
              {/* Placeholder - would show actual image when S3 is configured */}
              <div className="text-center">
                <svg
                  className="w-20 h-20 mx-auto text-(--text)"
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
                <p className="text-(--text) mt-2">
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

      {/* On Hold Modal */}
      {showOnHoldModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-(--text)">
                Put Project On Hold
              </h3>
            </div>
            <form onSubmit={handleOnHoldSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Reason for Hold <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={onHoldForm.reason}
                  onChange={(e) =>
                    setOnHoldForm({ ...onHoldForm, reason: e.target.value })
                  }
                  required
                  rows={3}
                  placeholder="Explain why this project is being put on hold..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Expected Resume Date (optional)
                </label>
                <input
                  type="date"
                  value={onHoldForm.expectedResumeDate}
                  onChange={(e) =>
                    setOnHoldForm({ ...onHoldForm, expectedResumeDate: e.target.value })
                  }
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowOnHoldModal(false);
                    setOnHoldForm({ reason: "", expectedResumeDate: "" });
                  }}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus || !onHoldForm.reason.trim()}
                  className="flex-1 rounded-full bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-yellow-600 transition"
                >
                  {updatingStatus ? "Updating..." : "Put On Hold"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Client Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-md rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-(--text)">
                Invite Client to Project
              </h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail("");
                  setInviteError("");
                  setInviteSuccess("");
                }}
                className="p-1 rounded-lg hover:bg-(--bg)"
              >
                <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-(--text) mb-4">
              Send an invitation email to a client. They&apos;ll be able to sign up and automatically get access to this project.
            </p>

            {inviteSuccess && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm mb-4">
                {inviteSuccess}
              </div>
            )}

            {inviteError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Client Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="client@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <button
                type="submit"
                disabled={sendingInvite || !inviteEmail.trim()}
                className="w-full tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {sendingInvite ? "Sending..." : "Send Invitation"}
              </button>
            </form>

            {invitations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-(--border)">
                <p className="text-xs uppercase tracking-wider text-(--text) mb-3">
                  Previous Invitations
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-(--bg) text-sm"
                    >
                      <span className="text-(--text) truncate flex-1">
                        {inv.email}
                      </span>
                      <span
                        className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                          inv.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : inv.status === "accepted"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change Request Modal */}
      {showChangeRequestModal && userRole === "client" && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-lg rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-(--text)">
                Request Changes
              </h3>
              <button
                onClick={() => {
                  setShowChangeRequestModal(false);
                  setChangeRequestError("");
                  setChangeRequestSuccess("");
                }}
                className="p-1 rounded-lg hover:bg-(--bg)"
              >
                <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-(--text) mb-4">
              Select the areas you want updated and include any details for the team.
            </p>
            <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {changeRequestOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                      changeRequestSections.includes(option.id)
                        ? "border-(--ring) bg-(--bg)"
                        : "border-(--border) hover:bg-(--bg)"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={changeRequestSections.includes(option.id)}
                      onChange={() => toggleChangeRequestSection(option.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-(--text)">{option.label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Details (optional)
                </label>
                <textarea
                  value={changeRequestMessage}
                  onChange={(e) => setChangeRequestMessage(e.target.value)}
                  rows={4}
                  placeholder="Add context or specific edits..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              {changeRequestError && (
                <div className="text-sm text-red-500">{changeRequestError}</div>
              )}
              {changeRequestSuccess && (
                <div className="text-sm text-green-600">{changeRequestSuccess}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangeRequestModal(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingChangeRequest || changeRequestSections.length === 0}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submittingChangeRequest ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProject && userRole === "admin" && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-10000 p-0 md:p-4">
          <div className="tl-card p-4 md:p-6 w-full max-w-lg rounded-none md:rounded-3xl max-h-svh md:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-(--text)">
                Edit Project
              </h3>
              <button
                onClick={() => setShowEditProject(false)}
                className="p-1 rounded-lg hover:bg-(--bg)"
              >
                <svg className="w-5 h-5 text-(--text)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Description
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Project description..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={projectForm.address}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, address: e.target.value })
                  }
                  placeholder="Project location address"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={projectForm.start_date}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, start_date: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={projectForm.end_date}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, end_date: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
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
    </div>
  );

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
}

