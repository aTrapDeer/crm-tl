"use client";

import { useEffect, useState } from "react";
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
    return <div className="text-[color:var(--tl-mid)]">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[color:var(--tl-navy)]">
          Client Dashboard
        </h2>
        <p className="text-sm text-[color:var(--tl-mid)] mt-1">
          View your projects and track progress
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[color:var(--tl-cyan)]/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-[color:var(--tl-navy)]"
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
          <p className="text-[color:var(--tl-navy)] font-medium">
            No projects yet
          </p>
          <p className="text-sm text-[color:var(--tl-mid)] mt-2">
            You&apos;ll see your projects here once you&apos;re added to one.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Projects List */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
              <h3 className="text-sm font-semibold text-[color:var(--tl-navy)] mb-4">
                Your Projects ({projects.length})
              </h3>
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      selectedProject?.id === project.id
                        ? "border-[color:var(--tl-cyan)] bg-[color:var(--tl-cyan)]/5"
                        : "border-[color:var(--tl-sand)] hover:border-[color:var(--tl-teal)]"
                    }`}
                  >
                    <div onClick={() => handleSelectProject(project)}>
                      <p className="font-medium text-[color:var(--tl-navy)]">
                        {project.name}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            statusColors[project.status] || statusColors.planning
                          }`}
                        >
                          {statusLabels[project.status] || project.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenDetails(project)}
                      className="mt-3 w-full text-xs py-2 rounded-lg bg-[color:var(--tl-navy)] text-white hover:bg-[color:var(--tl-deep)] transition"
                    >
                      View Details & Tasks
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedProject ? (
              <>
                {/* Project Overview */}
                <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
                        Project Overview
                      </p>
                      <h3 className="text-xl font-semibold text-[color:var(--tl-navy)] mt-1">
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
                        className="p-2 rounded-lg hover:bg-[color:var(--tl-offwhite)] transition"
                        title="View full details"
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
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {selectedProject.description && (
                    <p className="text-sm text-[color:var(--tl-mid)] mt-4">
                      {selectedProject.description}
                    </p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4 mt-6">
                    {selectedProject.address && (
                      <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
                          Location
                        </p>
                        <p className="text-sm font-medium text-[color:var(--tl-navy)] mt-1">
                          {selectedProject.address}
                        </p>
                      </div>
                    )}
                    {selectedProject.start_date && (
                      <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
                          Start Date
                        </p>
                        <p className="text-sm font-medium text-[color:var(--tl-navy)] mt-1">
                          {formatDate(selectedProject.start_date)}
                        </p>
                      </div>
                    )}
                    {selectedProject.budget_amount && (
                      <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
                          Budget
                        </p>
                        <p className="text-sm font-medium text-[color:var(--tl-navy)] mt-1">
                          ${selectedProject.budget_amount.toLocaleString()}
                        </p>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-[color:var(--tl-offwhite)]">
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
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
                        <span className="text-sm font-medium text-[color:var(--tl-navy)]">
                          {selectedProject.is_funded ? "Funded" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
                  <h4 className="text-sm font-semibold text-[color:var(--tl-navy)] mb-4">
                    Progress Updates
                  </h4>
                  {updates.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-[color:var(--tl-mid)]">
                        No updates yet. Check back soon!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {updates.map((update, index) => (
                        <div key={update.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-[color:var(--tl-cyan)]" />
                            {index < updates.length - 1 && (
                              <div className="w-0.5 h-full bg-[color:var(--tl-sand)] my-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
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
              <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-12 text-center">
                <p className="text-[color:var(--tl-mid)]">
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
