"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectDetailsModal from "@/app/components/ProjectDetailsModal";

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

interface ProjectUpdate {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  user_name?: string;
}

export default function WorkerDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [newUpdate, setNewUpdate] = useState({ title: "", content: "" });
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectProject(project: Project) {
    setSelectedProject(project);
    setEditStatus(project.status);
    try {
      const res = await fetch(`/api/projects/${project.id}/updates`);
      const data = await res.json();
      setUpdates(data.updates || []);
    } catch (error) {
      console.error("Failed to fetch updates:", error);
    }
  }

  function handleOpenDetails(project: Project) {
    if (typeof window !== "undefined") {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (isMobile) {
        router.push(`/dashboard/projects/${project.id}`);
        return;
      }
    }
    setSelectedProject(project);
    setShowDetailsModal(true);
  }

  function handleProjectUpdate(updatedProject: Project) {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    setSelectedProject(updatedProject);
  }

  async function handleAddUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUpdate),
      });

      if (res.ok) {
        setShowAddUpdate(false);
        setNewUpdate({ title: "", content: "" });
        handleSelectProject(selectedProject);
      }
    } catch (error) {
      console.error("Failed to add update:", error);
    }
  }

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });

      if (res.ok) {
        setShowEditProject(false);
        const updatedProject = { ...selectedProject, status: editStatus };
        setSelectedProject(updatedProject);
        fetchProjects();
      }
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  }

  const statusColors: Record<string, string> = {
    planning: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    on_hold: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return <div className="text-(--text)">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-(--text)">
          Worker Dashboard
        </h2>
        <p className="text-xs md:text-sm text-(--text) mt-1">
          Update progress on your assigned projects
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="tl-card p-12 text-center">
          <p className="text-(--text)">
            You haven&apos;t been assigned to any projects yet.
          </p>
          <p className="text-sm text-(--text) mt-2">
            Contact an admin to get assigned to a project.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 md:gap-8">
          {/* Projects List */}
          <div className="tl-card p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-(--text) mb-3 md:mb-4">
              Your Projects
            </h3>
            <div className="space-y-3 max-h-[400px] md:max-h-[500px] overflow-y-auto -mx-2 px-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 md:p-4 rounded-xl border-2 transition shadow-sm bg-white ${
                    selectedProject?.id === project.id
                      ? "border-(--border) bg-(--bg)/5 shadow-md"
                      : "border-(--border) hover:border-(--border) hover:shadow-md"
                  }`}
                >
                  <div
                    onClick={() => handleSelectProject(project)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-(--text) text-sm md:text-base line-clamp-2">
                          {project.name}
                        </p>
                        {project.address && (
                          <p className="text-xs md:text-sm text-(--text) mt-1 line-clamp-1">
                            {project.address}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full whitespace-nowrap shrink-0 font-medium ${
                          statusColors[project.status] || statusColors.planning
                        }`}
                      >
                        {project.status.replace("_", " ")}
                      </span>
                    </div>
                    {/* Budget & Funding Mini Display */}
                    <div className="flex items-center gap-3 md:gap-4 mt-3 text-xs text-(--text)">
                      {project.budget_amount && (
                        <span className="font-medium">${project.budget_amount.toLocaleString()}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            project.is_funded ? "bg-green-500" : "bg-yellow-500"
                          }`}
                        />
                        <span className="font-medium">{project.is_funded ? "Funded" : "Pending"}</span>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenDetails(project)}
                    className="mt-3 w-full tl-btn px-4 py-2.5 md:py-2 text-xs font-semibold"
                  >
                    View Details & Tasks
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-4 md:space-y-6">
            {selectedProject ? (
              <>
                <div className="tl-card p-4 md:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-(--text)">
                        {selectedProject.name}
                      </h3>
                      {selectedProject.description && (
                        <p className="text-sm text-(--text) mt-1">
                          {selectedProject.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowEditProject(true)}
                        className="text-sm text-(--text) hover:underline"
                      >
                        Edit Status
                      </button>
                      <button
                        onClick={() => handleOpenDetails(selectedProject)}
                        className="p-2 rounded-lg hover:bg-(--bg) transition"
                        title="View full details"
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
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowAddUpdate(true)}
                      className="tl-btn px-4 py-2 text-sm"
                    >
                      + Add Update
                    </button>
                  </div>
                </div>

                <div className="tl-card p-4 md:p-6">
                  <h4 className="text-sm font-semibold text-(--text) mb-3 md:mb-4">
                    Recent Updates
                  </h4>
                  {updates.length === 0 ? (
                    <p className="text-sm text-(--text)">
                      No updates yet. Add the first update!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {updates.map((update) => (
                        <div
                          key={update.id}
                          className="p-4 rounded-xl bg-(--bg)"
                        >
                          <div className="flex items-start justify-between">
                            <p className="font-medium text-(--text)">
                              {update.title}
                            </p>
                            <p className="text-xs text-(--text)">
                              {formatDate(update.created_at)}
                            </p>
                          </div>
                          {update.content && (
                            <p className="text-sm text-(--text) mt-2">
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
              </>
            ) : (
              <div className="tl-card p-12 text-center">
                <p className="text-(--text)">
                  Select a project to view details and add updates
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Update Modal */}
      {showAddUpdate && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-9999 p-0 md:p-4">
          <div className="tl-card p-4 md:p-8 w-full max-w-md rounded-t-3xl md:rounded-3xl rounded-b-none md:rounded-b-3xl">
            <h3 className="text-lg md:text-xl font-semibold text-(--text) mb-4 md:mb-6">
              Add Project Update
            </h3>
            <form onSubmit={handleAddUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newUpdate.title}
                  onChange={(e) =>
                    setNewUpdate({ ...newUpdate, title: e.target.value })
                  }
                  required
                  placeholder="e.g., Framing completed"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-2">
                  Details (optional)
                </label>
                <textarea
                  value={newUpdate.content}
                  onChange={(e) =>
                    setNewUpdate({ ...newUpdate, content: e.target.value })
                  }
                  rows={4}
                  placeholder="Add any additional details..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div className="flex gap-3 mt-6">
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

      {/* Edit Status Modal */}
      {showEditProject && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-9999 p-0 md:p-4">
          <div className="tl-card p-4 md:p-8 w-full max-w-md rounded-t-3xl md:rounded-3xl rounded-b-none md:rounded-b-3xl">
            <h3 className="text-lg md:text-xl font-semibold text-(--text) mb-4 md:mb-6">
              Update Project Status
            </h3>
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-2">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
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
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Details Modal */}
      {showDetailsModal && selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setShowDetailsModal(false)}
          userRole="worker"
          onProjectUpdate={handleProjectUpdate}
        />
      )}
    </div>
  );
}

