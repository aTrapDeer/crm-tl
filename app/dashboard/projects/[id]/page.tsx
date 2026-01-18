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

interface User {
  id: string;
  role: "admin" | "worker" | "client";
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<ProjectImage | null>(null);

  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [newImage, setNewImage] = useState({ filename: "", caption: "" });
  const [newUpdate, setNewUpdate] = useState({ title: "", content: "" });
  const [editForm, setEditForm] = useState({
    status: "",
    budget_amount: "",
    is_funded: false,
    funding_notes: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = currentUser?.role || "client";
  const canManageTasks = userRole === "admin" || userRole === "worker";
  const canManageImages = userRole === "admin" || userRole === "worker";
  const canEdit = userRole === "admin" || userRole === "worker";

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
      const [tasksRes, teamRes, imagesRes, updatesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/team`),
        fetch(`/api/projects/${projectId}/images`),
        fetch(`/api/projects/${projectId}/updates`),
      ]);

      const tasksData = await tasksRes.json();
      const teamData = await teamRes.json();
      const imagesData = await imagesRes.json();
      const updatesData = await updatesRes.json();

      setTasks(tasksData.tasks || []);
      setStats(tasksData.stats || { total: 0, completed: 0 });
      setTeam(teamData.team || []);
      setImages(imagesData.images || []);
      setUpdates(updatesData.updates || []);
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[color:var(--tl-navy)]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-[color:var(--tl-mid)]">Project not found</p>
        <Link
          href="/dashboard"
          className="text-[color:var(--tl-royal)] hover:underline mt-2 inline-block"
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
            className="text-sm text-[color:var(--tl-royal)] hover:underline mb-2 inline-flex items-center gap-1"
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
            <h1 className="text-3xl font-bold text-[color:var(--tl-navy)]">
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
            <p className="text-[color:var(--tl-mid)] mt-2 max-w-2xl">
              {project.description}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowEditProject(true)}
            className="rounded-xl bg-[color:var(--tl-navy)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Edit Project
          </button>
        )}
      </div>

      {/* Progress Section */}
      <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
        <h2 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
          Project Progress
        </h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[color:var(--tl-mid)]">
            {stats.completed} of {stats.total} tasks completed
          </span>
          <span className="text-2xl font-bold text-[color:var(--tl-navy)]">
            {progressPercent}%
          </span>
        </div>
        <div className="h-4 bg-[color:var(--tl-sand)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[color:var(--tl-cyan)] to-[color:var(--tl-royal)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details */}
          <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
            <h2 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
              Project Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {project.address && (
                <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                  <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                    Location
                  </p>
                  <p className="text-sm font-medium text-[color:var(--tl-navy)] mt-1">
                    {project.address}
                  </p>
                </div>
              )}
              {project.start_date && (
                <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                  <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                    Start Date
                  </p>
                  <p className="text-sm font-medium text-[color:var(--tl-navy)] mt-1">
                    {formatDate(project.start_date)}
                  </p>
                </div>
              )}
              <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                  Budget
                </p>
                <p className="text-lg font-semibold text-[color:var(--tl-navy)] mt-1">
                  {project.budget_amount
                    ? formatCurrency(project.budget_amount)
                    : "Not set"}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                  Funding Status
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-3 h-3 rounded-full ${
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
              <div className="mt-4 p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                <p className="text-xs uppercase tracking-wider text-[color:var(--tl-mid)]">
                  Funding Notes
                </p>
                <p className="text-sm text-[color:var(--tl-navy)] mt-1">
                  {project.funding_notes}
                </p>
              </div>
            )}
          </div>

          {/* Photos */}
          <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                Project Photos ({images.length})
              </h2>
              {canManageImages && (
                <button
                  onClick={() => setShowAddImage(true)}
                  className="text-sm px-4 py-2 rounded-lg bg-[color:var(--tl-navy)] text-white"
                >
                  + Add Photo
                </button>
              )}
            </div>
            {images.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-[color:var(--tl-sand)] rounded-xl">
                <svg
                  className="w-16 h-16 mx-auto text-[color:var(--tl-sand)]"
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
                <p className="text-[color:var(--tl-mid)] mt-4">No photos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    onClick={() => setShowImageViewer(image)}
                    className="aspect-square rounded-xl bg-[color:var(--tl-offwhite)] overflow-hidden cursor-pointer relative group"
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                      <svg
                        className="w-10 h-10 text-[color:var(--tl-sand)]"
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
                      <p className="text-xs text-[color:var(--tl-mid)] text-center truncate w-full mt-2">
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
          <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                Tasks ({tasks.length})
              </h2>
              {canManageTasks && (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="text-sm px-4 py-2 rounded-lg bg-[color:var(--tl-navy)] text-white"
                >
                  + Add Task
                </button>
              )}
            </div>
            {tasks.length === 0 ? (
              <p className="text-center text-[color:var(--tl-mid)] py-8">
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
                        : "bg-[color:var(--tl-offwhite)]"
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTask(task)}
                      disabled={!canManageTasks}
                      className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                        task.is_completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-[color:var(--tl-sand)] hover:border-[color:var(--tl-cyan)]"
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
                            : "text-[color:var(--tl-navy)]"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-sm text-[color:var(--tl-mid)] mt-1">
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
          <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
            <h2 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
              Project Team
            </h2>
            {team.length === 0 ? (
              <p className="text-sm text-[color:var(--tl-mid)]">
                No team members assigned
              </p>
            ) : (
              <div className="space-y-3">
                {team.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[color:var(--tl-offwhite)]"
                  >
                    <div className="w-10 h-10 rounded-full bg-[color:var(--tl-navy)] flex items-center justify-center text-white font-medium">
                      {member.first_name[0]}
                      {member.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-[color:var(--tl-navy)]">
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

          {/* Updates */}
          <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                Updates
              </h2>
              {canEdit && (
                <button
                  onClick={() => setShowAddUpdate(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[color:var(--tl-navy)] text-white"
                >
                  + Add
                </button>
              )}
            </div>
            {updates.length === 0 ? (
              <p className="text-sm text-[color:var(--tl-mid)]">No updates yet</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="p-3 rounded-xl bg-[color:var(--tl-offwhite)]"
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-[color:var(--tl-navy)]">
                        {update.title}
                      </p>
                      <p className="text-xs text-[color:var(--tl-mid)]">
                        {formatDateTime(update.created_at)}
                      </p>
                    </div>
                    {update.content && (
                      <p className="text-sm text-[color:var(--tl-mid)] mt-1">
                        {update.content}
                      </p>
                    )}
                    {update.user_name && (
                      <p className="text-xs text-[color:var(--tl-mid)] mt-2">
                        — {update.user_name}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium"
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

      {/* Add Image Modal */}
      {showAddImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
              Add Project Photo
            </h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[color:var(--tl-sand)] rounded-xl p-8 text-center cursor-pointer hover:border-[color:var(--tl-cyan)] transition mb-4"
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
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="text-center text-sm text-[color:var(--tl-mid)] mb-4">
              — or add manually —
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
                className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
              />
              <input
                type="text"
                value={newImage.caption}
                onChange={(e) =>
                  setNewImage({ ...newImage, caption: e.target.value })
                }
                placeholder="Caption (optional)"
                className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddImage(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[color:var(--tl-navy)] px-4 py-2.5 text-sm font-semibold text-white"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
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
                className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
              />
              <textarea
                value={newUpdate.content}
                onChange={(e) =>
                  setNewUpdate({ ...newUpdate, content: e.target.value })
                }
                rows={4}
                placeholder="Details (optional)"
                className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddUpdate(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[color:var(--tl-navy)] px-4 py-2.5 text-sm font-semibold text-white"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
              Edit Project
            </h3>
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
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
                    <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
                      Budget Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--tl-mid)]">
                        $
                      </span>
                      <input
                        type="number"
                        value={editForm.budget_amount}
                        onChange={(e) =>
                          setEditForm({ ...editForm, budget_amount: e.target.value })
                        }
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
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
                    <span className="text-sm font-medium text-[color:var(--tl-navy)]">
                      Project is funded
                    </span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-1">
                      Funding Notes
                    </label>
                    <textarea
                      value={editForm.funding_notes}
                      onChange={(e) =>
                        setEditForm({ ...editForm, funding_notes: e.target.value })
                      }
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)]"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditProject(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium"
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

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden">
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
              <div className="text-center">
                <svg
                  className="w-24 h-24 mx-auto text-[color:var(--tl-sand)]"
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
                <p className="text-[color:var(--tl-mid)] mt-4">
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

