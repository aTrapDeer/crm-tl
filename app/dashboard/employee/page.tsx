"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProjectDetailsModal from "@/app/components/ProjectDetailsModal";
import { ModalLayer } from "@/app/components/ModalLayer";

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

export default function EmployeeDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [workOrderCount, setWorkOrderCount] = useState(0);
  const [incidentReportCount, setIncidentReportCount] = useState(0);
  const [dailyReportCount, setDailyReportCount] = useState(0);
  const [weeklyReportCount, setWeeklyReportCount] = useState(0);
  const [monthlyReportCount, setMonthlyReportCount] = useState(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [newUpdate, setNewUpdate] = useState({ title: "", content: "" });
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [onboardingChecklist, setOnboardingChecklist] = useState({
    reviewedProjects: false,
    postedUpdate: false,
    understandsCommunication: false,
  });

  useEffect(() => {
    fetchProjects();
    fetchOnboardingStatus();
    fetchOperationsSummary();
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

  async function fetchOnboardingStatus() {
    try {
      const res = await fetch("/api/employees/onboarding");
      const data = await res.json();
      if (res.ok) {
        setShowOnboarding(!data.onboarding?.completed);
      }
    } catch (error) {
      console.error("Failed to fetch onboarding status:", error);
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function fetchOperationsSummary() {
    try {
      const [workOrdersRes, incidentReportsRes, dailyReportsRes, weeklyReportsRes, monthlyReportsRes] = await Promise.all([
        fetch("/api/work-orders"),
        fetch("/api/incident-reports"),
        fetch("/api/bonan/reports?report_type=daily"),
        fetch("/api/bonan/reports?report_type=weekly"),
        fetch("/api/bonan/reports?report_type=monthly"),
      ]);

      const workOrdersData = await workOrdersRes.json().catch(() => ({ workOrders: [] }));
      const incidentReportsData = await incidentReportsRes.json().catch(() => ({ incidentReports: [] }));
      const dailyReportsData = await dailyReportsRes.json().catch(() => ({ reports: [] }));
      const weeklyReportsData = await weeklyReportsRes.json().catch(() => ({ reports: [] }));
      const monthlyReportsData = await monthlyReportsRes.json().catch(() => ({ reports: [] }));

      if (workOrdersRes.ok) {
        setWorkOrderCount((workOrdersData.workOrders || []).length);
      }
      if (incidentReportsRes.ok) {
        setIncidentReportCount((incidentReportsData.incidentReports || []).length);
      }
      if (dailyReportsRes.ok) {
        setDailyReportCount((dailyReportsData.reports || []).length);
      }
      if (weeklyReportsRes.ok) {
        setWeeklyReportCount((weeklyReportsData.reports || []).length);
      }
      if (monthlyReportsRes.ok) {
        setMonthlyReportCount((monthlyReportsData.reports || []).length);
      }
    } catch (error) {
      console.error("Failed to fetch employee operations summary:", error);
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

  async function handleCompleteOnboarding() {
    setCompletingOnboarding(true);
    try {
      const res = await fetch("/api/employees/onboarding", { method: "POST" });
      if (res.ok) {
        setShowOnboarding(false);
      }
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    } finally {
      setCompletingOnboarding(false);
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

  if (loading || onboardingLoading) {
    return <div className="text-(--text)">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-(--text)">
          Employee Dashboard
        </h2>
        <p className="text-xs md:text-sm text-(--text) mt-1">
          View projects, daily walkthroughs, and assigned work orders
        </p>
      </div>

      <section className="tl-card p-4 md:p-5">
        <p className="text-xs uppercase tracking-wide text-(--text)/60">Quick Access</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Link
            href="/dashboard/work-orders"
            className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 hover:shadow-md transition"
          >
            <p className="text-sm font-semibold">Work Orders</p>
            <p className="text-xs text-blue-900/80 mt-1">Open assigned work and updates.</p>
          </Link>
          <Link
            href="/dashboard/incident-reports"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 hover:shadow-md transition"
          >
            <p className="text-sm font-semibold">Incident Reports</p>
            <p className="text-xs text-red-900/80 mt-1">Review and complete incident documentation.</p>
          </Link>
          <Link
            href="/dashboard/management/work-orders/new?site=bonan_towers&returnTo=/dashboard/employee"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 hover:shadow-md transition"
          >
            <p className="text-sm font-semibold">+ New Bonan Work Order</p>
            <p className="text-xs text-emerald-900/80 mt-1">Start a Bonan work order right from the employee portal.</p>
          </Link>
          <Link
            href="/dashboard/management/incident-reports/new?returnTo=/dashboard/employee"
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 hover:shadow-md transition"
          >
            <p className="text-sm font-semibold">+ New Bonan Incident</p>
            <p className="text-xs text-amber-900/80 mt-1">Create a Bonan incident report without opening a walkthrough first.</p>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Link
          href="/dashboard/work-orders"
          className="tl-card p-5 border border-blue-200 bg-blue-50/70 hover:shadow-lg transition"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Operations</p>
          <h3 className="text-lg font-semibold text-blue-950 mt-2">Work Orders</h3>
          <p className="text-sm text-blue-900/80 mt-2">
            Open and update your assigned work orders.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-blue-800">
            {workOrderCount} assigned
          </p>
        </Link>

        <Link
          href="/dashboard/incident-reports"
          className="tl-card p-5 border border-red-200 bg-red-50/70 hover:shadow-lg transition"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Operations</p>
          <h3 className="text-lg font-semibold text-red-950 mt-2">Incident Reports</h3>
          <p className="text-sm text-red-900/80 mt-2">
            Track open incidents and publish finalized reports.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-red-800">
            {incidentReportCount} reports
          </p>
        </Link>

        <Link
          href="/dashboard/bonan/daily"
          className="tl-card p-5 border border-emerald-200 bg-emerald-50/70 hover:shadow-lg transition"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Operations</p>
          <h3 className="text-lg font-semibold text-emerald-950 mt-2">Daily Walk-Throughs</h3>
          <p className="text-sm text-emerald-900/80 mt-2">
            Complete Bonan daily walkthrough reports and section follow-ups.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            {dailyReportCount} reports
          </p>
        </Link>

        <Link
          href="/dashboard/bonan/weekly"
          className="tl-card p-5 border border-teal-200 bg-teal-50/70 hover:shadow-lg transition"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Bonan</p>
          <h3 className="text-lg font-semibold text-teal-950 mt-2">Weekly Reports</h3>
          <p className="text-sm text-teal-900/80 mt-2">
            Review and update weekly system checks tied to daily walkthroughs.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-teal-800">
            {weeklyReportCount} reports
          </p>
        </Link>

        <Link
          href="/dashboard/bonan/monthly"
          className="tl-card p-5 border border-amber-200 bg-amber-50/70 hover:shadow-lg transition"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Bonan</p>
          <h3 className="text-lg font-semibold text-amber-950 mt-2">Monthly Reports</h3>
          <p className="text-sm text-amber-900/80 mt-2">
            Access monthly checklists and summary views connected to weekly and daily reports.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {monthlyReportCount} reports
          </p>
        </Link>
      </section>

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
                    </div>
                    <div className="flex items-center gap-2">
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
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowAddUpdate(false)}>
          <div
            className="tl-card p-4 md:p-8 w-full max-w-md rounded-t-3xl md:rounded-3xl rounded-b-none md:rounded-b-3xl"
            onClick={(e) => e.stopPropagation()}
          >
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
        </ModalLayer>
      )}

      {showOnboarding && (
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowOnboarding(false)}>
          <div
            className="tl-card p-4 md:p-8 w-full max-w-lg rounded-t-3xl md:rounded-3xl rounded-b-none md:rounded-b-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg md:text-xl font-semibold text-(--text) mb-2">
              Employee Onboarding
            </h3>
            <p className="text-sm text-(--text) mb-5">
              Complete this quick checklist before you start working in projects.
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-(--border) bg-(--bg)">
                <input
                  type="checkbox"
                  checked={onboardingChecklist.reviewedProjects}
                  onChange={(e) =>
                    setOnboardingChecklist((prev) => ({
                      ...prev,
                      reviewedProjects: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm text-(--text)">
                  I reviewed my assigned projects and current statuses.
                </span>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-(--border) bg-(--bg)">
                <input
                  type="checkbox"
                  checked={onboardingChecklist.postedUpdate}
                  onChange={(e) =>
                    setOnboardingChecklist((prev) => ({
                      ...prev,
                      postedUpdate: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm text-(--text)">
                  I know how to add updates and keep project notes clear.
                </span>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-(--border) bg-(--bg)">
                <input
                  type="checkbox"
                  checked={onboardingChecklist.understandsCommunication}
                  onChange={(e) =>
                    setOnboardingChecklist((prev) => ({
                      ...prev,
                      understandsCommunication: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm text-(--text)">
                  I understand communication expectations and escalation flow.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleCompleteOnboarding}
              disabled={
                completingOnboarding ||
                !onboardingChecklist.reviewedProjects ||
                !onboardingChecklist.postedUpdate ||
                !onboardingChecklist.understandsCommunication
              }
              className="mt-6 w-full tl-btn px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {completingOnboarding ? "Saving..." : "Complete Onboarding"}
            </button>
          </div>
        </ModalLayer>
      )}

      {/* Project Details Modal */}
      {showDetailsModal && selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setShowDetailsModal(false)}
          userRole="employee"
          onProjectUpdate={handleProjectUpdate}
        />
      )}
    </div>
  );
}
