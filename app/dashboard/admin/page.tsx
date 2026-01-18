"use client";

import { useEffect, useState } from "react";
import ProjectDetailsModal from "@/app/components/ProjectDetailsModal";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";

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

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Assignment {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    status: "planning",
    address: "",
    budget_amount: "",
    is_funded: false,
    funding_notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [projectsRes, usersRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/users"),
      ]);
      const projectsData = await projectsRes.json();
      const usersData = await usersRes.json();

      setProjects(projectsData.projects || []);
      setUsers(usersData.users || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProject,
          budget_amount: newProject.budget_amount
            ? parseFloat(newProject.budget_amount)
            : null,
        }),
      });

      if (res.ok) {
        setShowNewProject(false);
        setNewProject({
          name: "",
          description: "",
          status: "planning",
          address: "",
          budget_amount: "",
          is_funded: false,
          funding_notes: "",
        });
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  }

  async function handleSelectProject(project: Project) {
    setSelectedProject(project);
    try {
      const res = await fetch(`/api/projects/${project.id}/assignments`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
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

  async function handleAssignUser(userId: string) {
    if (!selectedProject) return;
    try {
      await fetch(`/api/projects/${selectedProject.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      handleSelectProject(selectedProject);
    } catch (error) {
      console.error("Failed to assign user:", error);
    }
  }

  async function handleUnassignUser(userId: string) {
    if (!selectedProject) return;
    try {
      await fetch(`/api/projects/${selectedProject.id}/assignments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      handleSelectProject(selectedProject);
    } catch (error) {
      console.error("Failed to unassign user:", error);
    }
  }

  const statusColors: Record<string, string> = {
    planning: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    on_hold: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
  };

  const statusCardStyles: Record<string, string> = {
    planning: "border-l-4 border-l-gray-400",
    in_progress: "border-l-4 border-l-blue-500",
    on_hold: "border-l-4 border-l-yellow-500 bg-yellow-50/50",
    completed: "border-l-4 border-l-green-500 bg-green-50/30",
  };

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (loading) {
    return <div className="text-[color:var(--tl-mid)]">Loading...</div>;
  }

  const totalBudget = projects.reduce(
    (sum, p) => sum + (p.budget_amount || 0),
    0
  );
  const fundedProjects = projects.filter((p) => p.is_funded).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[color:var(--tl-navy)]">
            Admin Dashboard
          </h2>
          <p className="text-sm text-[color:var(--tl-mid)] mt-1">
            Manage all projects, users, and assignments
          </p>
        </div>
        <button
          onClick={() => setShowNewProject(true)}
          className="rounded-xl bg-[color:var(--tl-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(1,34,79,0.2)] transition hover:bg-[color:var(--tl-deep)]"
        >
          + New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[color:var(--tl-sand)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
            Total Projects
          </p>
          <p className="text-3xl font-semibold text-[color:var(--tl-navy)] mt-2">
            {projects.length}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--tl-sand)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
            Active Projects
          </p>
          <p className="text-3xl font-semibold text-[color:var(--tl-navy)] mt-2">
            {projects.filter((p) => p.status === "in_progress").length}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--tl-sand)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
            Total Budget
          </p>
          <p className="text-2xl font-semibold text-[color:var(--tl-navy)] mt-2">
            {formatCurrency(totalBudget)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--tl-sand)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
            Funded Projects
          </p>
          <p className="text-3xl font-semibold text-[color:var(--tl-navy)] mt-2">
            {fundedProjects}
            <span className="text-lg text-[color:var(--tl-mid)]">
              /{projects.length}
            </span>
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Projects List */}
        <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
          <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
            All Projects
          </h3>
          {projects.length === 0 ? (
            <p className="text-sm text-[color:var(--tl-mid)]">
              No projects yet. Create your first project.
            </p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-4 rounded-xl border transition ${
                    statusCardStyles[project.status] || statusCardStyles.planning
                  } ${
                    selectedProject?.id === project.id
                      ? "border-[color:var(--tl-cyan)] bg-[color:var(--tl-cyan)]/5"
                      : "border-[color:var(--tl-sand)] hover:border-[color:var(--tl-teal)]"
                  }`}
                >
                  <div
                    onClick={() => handleSelectProject(project)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[color:var(--tl-navy)] truncate">
                          {project.name}
                        </p>
                        {project.description && (
                          <p className="text-sm text-[color:var(--tl-mid)] mt-1 truncate">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`ml-2 text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          statusColors[project.status] || statusColors.planning
                        }`}
                      >
                        {project.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* On Hold Alert */}
                    {project.status === "on_hold" && project.on_hold_reason && (
                      <div className="mt-2 p-2 rounded-lg bg-yellow-100 border border-yellow-200">
                        <div className="flex items-center gap-2 text-xs text-yellow-800">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="line-clamp-1">{project.on_hold_reason}</span>
                        </div>
                      </div>
                    )}

                    {/* Budget & Funding Row */}
                    <div className="flex items-center gap-4 mt-3 text-xs">
                      {project.budget_amount ? (
                        <span className="text-[color:var(--tl-navy)] font-medium">
                          {formatCurrency(project.budget_amount)}
                        </span>
                      ) : (
                        <span className="text-[color:var(--tl-mid)]">
                          No budget set
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            project.is_funded ? "bg-green-500" : "bg-yellow-500"
                          }`}
                        />
                        <span className="text-[color:var(--tl-mid)]">
                          {project.is_funded ? "Funded" : "Pending"}
                        </span>
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
          )}
        </div>

        {/* Project Details & Assignments */}
        <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
          {selectedProject ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                  {selectedProject.name} - Assignments
                </h3>
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

              {/* Quick Budget Info */}
              <div className="p-3 rounded-lg bg-[color:var(--tl-offwhite)] mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--tl-mid)]">Budget:</span>
                  <span className="font-medium text-[color:var(--tl-navy)]">
                    {selectedProject.budget_amount
                      ? formatCurrency(selectedProject.budget_amount)
                      : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[color:var(--tl-mid)]">Status:</span>
                  <span className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedProject.is_funded
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                    />
                    <span className="font-medium text-[color:var(--tl-navy)]">
                      {selectedProject.is_funded ? "Funded" : "Pending Funding"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)] mb-3">
                  Currently Assigned
                </p>
                {assignments.length === 0 ? (
                  <p className="text-sm text-[color:var(--tl-mid)]">
                    No users assigned yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div
                        key={a.user_id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[color:var(--tl-offwhite)]"
                      >
                        <div>
                          <p className="text-sm font-medium text-[color:var(--tl-navy)]">
                            {a.first_name} {a.last_name}
                          </p>
                          <p className="text-xs text-[color:var(--tl-mid)]">
                            {a.email} • {a.role}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnassignUser(a.user_id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)] mb-3">
                  Add User
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {users
                    .filter((u) => !assignments.some((a) => a.user_id === u.id))
                    .map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--tl-sand)]"
                      >
                        <div>
                          <p className="text-sm font-medium text-[color:var(--tl-navy)]">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-[color:var(--tl-mid)]">
                            {user.email} • {user.role}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAssignUser(user.id)}
                          className="text-xs text-[color:var(--tl-royal)] hover:underline"
                        >
                          Assign
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-[color:var(--tl-mid)]">
                Select a project to manage assignments
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="rounded-2xl border border-[color:var(--tl-sand)] bg-white p-6">
        <h3 className="text-lg font-semibold text-[color:var(--tl-navy)] mb-4">
          All Users ({users.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--tl-sand)]">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 text-sm text-[color:var(--tl-navy)]">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="py-3 text-sm text-[color:var(--tl-mid)]">
                    {user.email}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : user.role === "worker"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-[color:var(--tl-navy)] mb-6">
              Create New Project
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2">
                  Address
                </label>
                <AddressAutocomplete
                  value={newProject.address}
                  onChange={(value) =>
                    setNewProject({ ...newProject, address: value })
                  }
                  placeholder="Start typing an address..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2">
                  Status
                </label>
                <select
                  value={newProject.status}
                  onChange={(e) =>
                    setNewProject({ ...newProject, status: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Budget Section */}
              <div className="pt-4 border-t border-[color:var(--tl-sand)]">
                <p className="text-sm font-semibold text-[color:var(--tl-navy)] mb-4">
                  Budget & Funding
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2">
                      Budget Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--tl-mid)]">
                        $
                      </span>
                      <input
                        type="number"
                        value={newProject.budget_amount}
                        onChange={(e) =>
                          setNewProject({
                            ...newProject,
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
                        checked={newProject.is_funded}
                        onChange={(e) =>
                          setNewProject({
                            ...newProject,
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
                    <label className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2">
                      Funding Notes
                    </label>
                    <textarea
                      value={newProject.funding_notes}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          funding_notes: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="Notes about funding status, payment terms, etc."
                      className="w-full px-4 py-2.5 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 rounded-xl border border-[color:var(--tl-sand)] px-4 py-2.5 text-sm font-medium text-[color:var(--tl-navy)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[color:var(--tl-navy)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Create Project
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
          userRole="admin"
          onProjectUpdate={handleProjectUpdate}
        />
      )}
    </div>
  );
}
