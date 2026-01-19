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

export default function ClientDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="text-(--text)">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-(--text)">
          Client Dashboard
        </h2>
        <p className="text-xs md:text-sm text-(--text) mt-1">
          View your projects and track progress
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="tl-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-(--bg)/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-(--text)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <p className="text-(--text) font-medium">
            No projects yet
          </p>
          <p className="text-sm text-(--text) mt-2">
            You&apos;ll see your projects here once you&apos;re added to one.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Projects List */}
          <div className="lg:col-span-1">
            <div className="tl-card p-4 md:p-6">
              <h3 className="text-sm font-semibold text-(--text) mb-3 md:mb-4">
                Your Projects ({projects.length})
              </h3>
              <div className="space-y-3 max-h-[400px] md:max-h-[500px] overflow-y-auto -mx-2 px-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`p-3 md:p-4 rounded-xl border-2 cursor-pointer transition shadow-sm bg-white ${
                      selectedProject?.id === project.id
                        ? "border-(--border) bg-(--bg)/5 shadow-md"
                        : "border-(--border) hover:border-(--border) hover:shadow-md"
                    }`}
                  >
                    <div onClick={() => handleSelectProject(project)}>
                      <p className="font-semibold text-(--text) text-sm md:text-base line-clamp-2">
                        {project.name}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            statusColors[project.status] || statusColors.planning
                          }`}
                        >
                          {statusLabels[project.status] || project.status}
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
          </div>

          {/* Project Details */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {selectedProject ? (
              <>
                {/* Project Overview */}
                <div className="tl-card p-4 md:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-(--text)">
                        Project Overview
                      </p>
                      <h3 className="text-xl font-semibold text-(--text) mt-1">
                        {selectedProject.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm px-3 py-1.5 rounded-full ${
                          statusColors[selectedProject.status] ||
                          statusColors.planning
                        }`}
                      >
                        {statusLabels[selectedProject.status] ||
                          selectedProject.status}
                      </span>
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

                  {selectedProject.description && (
                    <p className="text-sm text-(--text) mt-4">
                      {selectedProject.description}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-4 md:mt-6">
                    {selectedProject.address && (
                      <div className="p-4 rounded-xl bg-(--bg)">
                        <p className="text-xs uppercase tracking-[0.2em] text-(--text)">
                          Location
                        </p>
                        <p className="text-sm font-medium text-(--text) mt-1">
                          {selectedProject.address}
                        </p>
                      </div>
                    )}
                    {selectedProject.start_date && (
                      <div className="p-4 rounded-xl bg-(--bg)">
                        <p className="text-xs uppercase tracking-[0.2em] text-(--text)">
                          Start Date
                        </p>
                        <p className="text-sm font-medium text-(--text) mt-1">
                          {formatDate(selectedProject.start_date)}
                        </p>
                      </div>
                    )}
                    {selectedProject.budget_amount && (
                      <div className="p-4 rounded-xl bg-(--bg)">
                        <p className="text-xs uppercase tracking-[0.2em] text-(--text)">
                          Budget
                        </p>
                        <p className="text-sm font-medium text-(--text) mt-1">
                          ${selectedProject.budget_amount.toLocaleString()}
                        </p>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-(--bg)">
                      <p className="text-xs uppercase tracking-[0.2em] text-(--text)">
                        Funding Status
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selectedProject.is_funded
                              ? "bg-green-500"
                              : "bg-yellow-500"
                          }`}
                        />
                        <span className="text-sm font-medium text-(--text)">
                          {selectedProject.is_funded ? "Funded" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="tl-card p-4 md:p-6">
                  <h4 className="text-sm font-semibold text-(--text) mb-3 md:mb-4">
                    Progress Updates
                  </h4>
                  {updates.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-(--text)">
                        No updates yet. Check back soon!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {updates.map((update, index) => (
                        <div key={update.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-(--bg)" />
                            {index < updates.length - 1 && (
                              <div className="w-0.5 h-full bg-(--bg) my-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="tl-card p-12 text-center">
                <p className="text-(--text)">
                  Select a project to view details and updates
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Details Modal */}
      {showDetailsModal && selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setShowDetailsModal(false)}
          userRole="client"
          onProjectUpdate={handleProjectUpdate}
        />
      )}
    </div>
  );
}

