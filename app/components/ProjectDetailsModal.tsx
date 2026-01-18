"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

interface ProjectDetailsModalProps {
  project: Project;
  onClose: () => void;
  userRole: "admin" | "worker" | "client";
  onProjectUpdate?: (project: Project) => void;
}

export default function ProjectDetailsModal({
  project,
  onClose,
  userRole,
  onProjectUpdate,
}: ProjectDetailsModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({ total: 0, completed: 0 });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditBudget, setShowEditBudget] = useState(false);
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

  const canManageTasks = userRole === "admin" || userRole === "worker";
  const canManageImages = userRole === "admin" || userRole === "worker";
  const canEditBudget = userRole === "admin";

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, teamRes, imagesRes] = await Promise.all([
        fetch(`/api/projects/${project.id}/tasks`),
        fetch(`/api/projects/${project.id}/team`),
        fetch(`/api/projects/${project.id}/images`),
      ]);

      const tasksData = await tasksRes.json();
      const teamData = await teamRes.json();
      const imagesData = await imagesRes.json();

      setTasks(tasksData.tasks || []);
      setStats(tasksData.stats || { total: 0, completed: 0 });
      setTeam(teamData.team || []);
      setImages(imagesData.images || []);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[color:var(--tl-sand)]">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold text-[color:var(--tl-navy)] truncate">
                  {project.name}
                </h2>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                    statusColors[project.status] || statusColors.planning
                  }`}
                >
                  {statusLabels[project.status] || project.status}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-[color:var(--tl-mid)]">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="p-2 rounded-lg hover:bg-[color:var(--tl-offwhite)] transition"
                title="Open full page"
              >
                <svg
                  className="w-5 h-5 text-[color:var(--tl-navy)]"
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
                className="p-2 rounded-lg hover:bg-[color:var(--tl-offwhite)] transition"
              >
                <svg
                  className="w-5 h-5 text-[color:var(--tl-mid)]"
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--tl-navy)]" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[color:var(--tl-navy)]">
                    Task Progress
                  </span>
                  <span className="text-sm text-[color:var(--tl-mid)]">
                    {stats.completed} / {stats.total} tasks
                  </span>
                </div>
                <div className="h-3 bg-[color:var(--tl-sand)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[color:var(--tl-cyan)] to-[color:var(--tl-royal)] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-[color:var(--tl-mid)] mt-2 text-right">
                  {progressPercent}% complete
                </p>
              </div>

              {/* Budget & Funding */}
              <div className="p-4 rounded-xl border border-[color:var(--tl-sand)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[color:var(--tl-navy)]">
                    Budget & Funding
                  </h3>
                  {canEditBudget && (
                    <button
                      onClick={() => setShowEditBudget(true)}
                      className="text-xs text-[color:var(--tl-royal)] hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                      Budget
                    </p>
                    <p className="text-lg font-semibold text-[color:var(--tl-navy)] mt-1">
                      {project.budget_amount
                        ? formatCurrency(project.budget_amount)
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                      Funding Status
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          project.is_funded ? "bg-green-500" : "bg-yellow-500"
                        }`}
                      />
                      <span className="text-sm font-medium text-[color:var(--tl-navy)]">
                        {project.is_funded ? "Funded" : "Pending Funding"}
                      </span>
                    </div>
                  </div>
                </div>
                {project.funding_notes && (
                  <div className="mt-4 pt-4 border-t border-[color:var(--tl-sand)]">
                    <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)] mb-1">
                      Funding Notes
                    </p>
                    <p className="text-sm text-[color:var(--tl-navy)]">
                      {project.funding_notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Project Info */}
              <div className="grid sm:grid-cols-2 gap-4">
                {project.address && (
                  <div className="p-3 rounded-xl bg-[color:var(--tl-offwhite)]">
                    <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                      Location
                    </p>
                    <p className="text-sm font-medium text-[color:var(--tl-navy)] mt-1">
                      {project.address}
                    </p>
                  </div>
                )}
                {project.start_date && (
                  <div className="p-3 rounded-xl bg-[color:var(--tl-offwhite)]">
                    <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                      Start Date
                    </p>
                    <p className="text-sm font-medium text-[color:var(--tl-navy)] mt-1">
                      {formatDate(project.start_date)}
                    </p>
                  </div>
                )}
              </div>

              {/* Project Photos */}
              <div className="p-4 rounded-xl border border-[color:var(--tl-sand)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[color:var(--tl-navy)]">
                    Project Photos ({images.length})
                  </h3>
                  {canManageImages && (
                    <button
                      onClick={() => setShowAddImage(true)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[color:var(--tl-navy)] text-white hover:bg-[color:var(--tl-deep)] transition"
                    >
                      + Add Photo
                    </button>
                  )}
                </div>
                {images.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-[color:var(--tl-sand)] rounded-xl">
                    <svg
                      className="w-12 h-12 mx-auto text-[color:var(--tl-sand)]"
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
                    <p className="text-sm text-[color:var(--tl-mid)] mt-2">
                      No photos yet
                    </p>
                    <p className="text-xs text-[color:var(--tl-mid)]">
                      {canManageImages
                        ? "Add photos to document project progress"
                        : "Photos will appear here once added"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        onClick={() => setShowImageViewer(image)}
                        className="aspect-square rounded-lg bg-[color:var(--tl-offwhite)] overflow-hidden cursor-pointer relative group"
                      >
                        {/* Placeholder - would show actual image when S3 is configured */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                          <svg
                            className="w-8 h-8 text-[color:var(--tl-sand)]"
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
                          <p className="text-xs text-[color:var(--tl-mid)] text-center truncate w-full mt-1">
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
              <div className="p-4 rounded-xl border border-[color:var(--tl-sand)]">
                <h3 className="text-sm font-semibold text-[color:var(--tl-navy)] mb-3">
                  Project Team
                </h3>
                {team.length === 0 ? (
                  <p className="text-sm text-[color:var(--tl-mid)]">
                    No team members assigned yet
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {team.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[color:var(--tl-offwhite)]"
                      >
                        <div className="w-8 h-8 rounded-full bg-[color:var(--tl-navy)] flex items-center justify-center text-white text-xs font-medium">
                          {member.first_name[0]}
                          {member.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[color:var(--tl-navy)]">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-xs text-[color:var(--tl-mid)] capitalize">
                            {member.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="p-4 rounded-xl border border-[color:var(--tl-sand)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[color:var(--tl-navy)]">
                    Tasks
                  </h3>
                  {canManageTasks && (
                    <button
                      onClick={() => setShowAddTask(true)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[color:var(--tl-navy)] text-white hover:bg-[color:var(--tl-deep)] transition"
                    >
                      + Add Task
                    </button>
                  )}
                </div>
                {tasks.length === 0 ? (
                  <p className="text-sm text-[color:var(--tl-mid)] text-center py-4">
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
                            : "bg-[color:var(--tl-offwhite)]"
                        }`}
                      >
                        <button
                          onClick={() => handleToggleTask(task)}
                          disabled={!canManageTasks}
                          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                            task.is_completed
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-[color:var(--tl-sand)] hover:border-[color:var(--tl-cyan)]"
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
                                : "text-[color:var(--tl-navy)]"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-[color:var(--tl-mid)] mt-1">
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
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
              Add New Task
            </h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Additional details..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium text-[color:var(--tl-navy)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[color:var(--tl-navy)] px-4 py-2.5 text-sm font-semibold text-white"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
              Edit Budget & Funding
            </h3>
            <form onSubmit={handleUpdateBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
                  Budget Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--tl-mid)]">
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
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
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
                    className="w-5 h-5 rounded border-[color:var(--tl-sand)] text-[color:var(--tl-cyan)] focus:ring-[color:var(--tl-cyan)]"
                  />
                  <span className="text-sm font-medium text-[color:var(--tl-navy)]">
                    Project is funded
                  </span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditBudget(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium text-[color:var(--tl-navy)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[color:var(--tl-navy)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Image Modal */}
      {showAddImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
              Add Project Photo
            </h3>
            
            {/* File Upload Area */}
            <div className="mb-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[color:var(--tl-sand)] rounded-xl p-8 text-center cursor-pointer hover:border-[color:var(--tl-cyan)] transition"
              >
                <svg
                  className="w-12 h-12 mx-auto text-[color:var(--tl-sand)]"
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
                <p className="text-sm text-[color:var(--tl-mid)] mt-2">
                  Click to select a photo
                </p>
                <p className="text-xs text-[color:var(--tl-sand)]">
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

            <div className="text-center text-sm text-[color:var(--tl-mid)] mb-4">
              — or add manually —
            </div>

            <form onSubmit={handleAddImage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
                  Caption (optional)
                </label>
                <input
                  type="text"
                  value={newImage.caption}
                  onChange={(e) =>
                    setNewImage({ ...newImage, caption: e.target.value })
                  }
                  placeholder="Describe this photo..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddImage(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium text-[color:var(--tl-navy)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 rounded-xl bg-[color:var(--tl-navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-[color:var(--tl-sand)] flex items-center justify-between">
              <div>
                <p className="font-medium text-[color:var(--tl-navy)]">
                  {showImageViewer.filename}
                </p>
                {showImageViewer.caption && (
                  <p className="text-sm text-[color:var(--tl-mid)]">
                    {showImageViewer.caption}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowImageViewer(null)}
                className="p-2 rounded-lg hover:bg-[color:var(--tl-offwhite)]"
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
            <div className="aspect-video bg-[color:var(--tl-offwhite)] flex items-center justify-center">
              {/* Placeholder - would show actual image when S3 is configured */}
              <div className="text-center">
                <svg
                  className="w-20 h-20 mx-auto text-[color:var(--tl-sand)]"
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
                <p className="text-[color:var(--tl-mid)] mt-2">
                  Image preview unavailable
                </p>
                <p className="text-xs text-[color:var(--tl-sand)]">
                  S3 not configured
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between border-t border-[color:var(--tl-sand)]">
              <div className="text-xs text-[color:var(--tl-mid)]">
                {showImageViewer.uploader_name && (
                  <span>Uploaded by {showImageViewer.uploader_name} • </span>
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
