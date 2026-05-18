"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProjectDetailsModal from "@/app/components/ProjectDetailsModal";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { ModalLayer } from "@/app/components/ModalLayer";
import {
  formatUsCentralDateTime,
  getMonthKey,
  getWeekEndSaturday,
} from "@/lib/us-central-time";
import { PREDEFINED_CATEGORIES } from "@/lib/estimate-categories";

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

interface EstimateItem {
  category: string;
  customName: string;
  description: string;
  priceRate: string;
  quantity: string;
}

interface EstimateCustomEntry {
  id: string;
  name: string;
  description: string | null;
  default_price_rate: number;
  default_quantity: number;
}

type BonanReportStatus = "draft" | "submitted";

interface BonanHighlightReport {
  id: string;
  report_date: string;
  status: BonanReportStatus;
  updated_at: string;
  payload?: {
    metadata?: {
      preparedBy?: string;
    };
    collectiveSummary?: {
      dailyWalkthroughCompletion?: string;
      criticalCheckupsCompletion?: string;
      monthlyCheckupCompletion?: string;
      incidentReportsFiled?: string;
    };
  };
}

interface BonanHighlightSummary {
  period_start: string;
  period_end: string;
  daily_reports: {
    due: number;
    submitted: number;
  };
  incidents: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
  };
  work_orders: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [customEntries, setCustomEntries] = useState<EstimateCustomEntry[]>([]);
  const [savingCustomEntryIndex, setSavingCustomEntryIndex] = useState<number | null>(null);
  const [latestWeeklyReport, setLatestWeeklyReport] = useState<BonanHighlightReport | null>(null);
  const [latestMonthlyReport, setLatestMonthlyReport] = useState<BonanHighlightReport | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<BonanHighlightSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<BonanHighlightSummary | null>(null);
  const [bonanHighlightsError, setBonanHighlightsError] = useState("");

  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    status: "planning",
    address: "",
  });
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [markupType, setMarkupType] = useState<"percentage" | "fixed">("percentage");
  const [markupValue, setMarkupValue] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [onlineServicingFee, setOnlineServicingFee] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [projectsRes, usersRes, customEntriesRes, weeklyReportsRes, monthlyReportsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/users"),
        fetch("/api/estimate/custom-entries"),
        fetch("/api/bonan/reports?report_type=weekly"),
        fetch("/api/bonan/reports?report_type=monthly"),
      ]);
      const projectsData = await projectsRes.json();
      const usersData = await usersRes.json();
      const customEntriesData = customEntriesRes.ok ? await customEntriesRes.json() : { entries: [] };
      const weeklyReportsData = weeklyReportsRes.ok ? await weeklyReportsRes.json() : { reports: [] };
      const monthlyReportsData = monthlyReportsRes.ok ? await monthlyReportsRes.json() : { reports: [] };

      const weeklyReports = (weeklyReportsData.reports || []) as BonanHighlightReport[];
      const monthlyReports = (monthlyReportsData.reports || []) as BonanHighlightReport[];
      const newestWeekly = weeklyReports[0] || null;
      const newestMonthly = monthlyReports[0] || null;

      setProjects(projectsData.projects || []);
      setUsers(usersData.users || []);
      setCustomEntries(customEntriesData.entries || []);
      setLatestWeeklyReport(newestWeekly);
      setLatestMonthlyReport(newestMonthly);

      const weeklySummaryPromise: Promise<Response | null> = newestWeekly
        ? fetch(`/api/bonan/reports/${newestWeekly.id}/summary`)
        : Promise.resolve(null);
      const monthlySummaryPromise: Promise<Response | null> = newestMonthly
        ? fetch(`/api/bonan/reports/${newestMonthly.id}/summary`)
        : Promise.resolve(null);

      const [weeklySummaryRes, monthlySummaryRes] = await Promise.all([
        weeklySummaryPromise,
        monthlySummaryPromise,
      ]);

      if (weeklySummaryRes && weeklySummaryRes.ok) {
        const data = await weeklySummaryRes.json();
        setWeeklySummary((data.summary || null) as BonanHighlightSummary | null);
      } else {
        setWeeklySummary(null);
      }

      if (monthlySummaryRes && monthlySummaryRes.ok) {
        const data = await monthlySummaryRes.json();
        setMonthlySummary((data.summary || null) as BonanHighlightSummary | null);
      } else {
        setMonthlySummary(null);
      }

      if (!weeklyReportsRes.ok || !monthlyReportsRes.ok) {
        setBonanHighlightsError("Bonan highlights are temporarily unavailable.");
      } else {
        setBonanHighlightsError("");
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setBonanHighlightsError("Bonan highlights are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(cat: string) {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories((prev) => prev.filter((c) => c !== cat));
      setEstimateItems((prev) => prev.filter((item) => item.category !== cat));
    } else {
      setSelectedCategories((prev) => [...prev, cat]);
      setEstimateItems((prev) => [
        ...prev,
        { category: cat, customName: "", description: "", priceRate: "", quantity: "1" },
      ]);
    }
  }

  function addCustomLineItem(template?: EstimateCustomEntry) {
    setEstimateItems((prev) => [
      ...prev,
      {
        category: "custom",
        customName: template?.name || "",
        description: template?.description || "",
        priceRate:
          template?.default_price_rate !== undefined
            ? String(template.default_price_rate)
            : "",
        quantity:
          template?.default_quantity !== undefined
            ? String(template.default_quantity)
            : "1",
      },
    ]);
  }

  function removeEstimateItem(index: number) {
    setEstimateItems((prev) => {
      const item = prev[index];
      const next = prev.filter((_, idx) => idx !== index);

      if (item && item.category !== "custom") {
        setSelectedCategories((current) =>
          current.filter((category) => category !== item.category)
        );
      }

      return next;
    });
  }

  async function handleSaveCustomEntry(index: number) {
    const item = estimateItems[index];
    if (!item || item.category !== "custom") return;

    const trimmedName = item.customName.trim();
    if (!trimmedName) {
      window.alert("Custom entry name is required before saving.");
      return;
    }

    setSavingCustomEntryIndex(index);
    try {
      const res = await fetch("/api/estimate/custom-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: item.description.trim(),
          default_price_rate: parseFloat(item.priceRate) || 0,
          default_quantity: parseFloat(item.quantity) || 1,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.alert(data.error || "Failed to save custom entry");
        return;
      }

      setCustomEntries((prev) => {
        const withoutCurrent = prev.filter((entry) => entry.id !== data.entry.id);
        return [...withoutCurrent, data.entry].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
    } catch (error) {
      console.error("Failed to save custom entry:", error);
      window.alert("Failed to save custom entry");
    } finally {
      setSavingCustomEntryIndex(null);
    }
  }

  function updateEstimateItem(index: number, field: keyof EstimateItem, value: string) {
    setEstimateItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function getItemTotal(item: EstimateItem): number {
    const rate = parseFloat(item.priceRate) || 0;
    const qty = parseFloat(item.quantity) || 0;
    return rate * qty;
  }

  function getEstimateGrandTotal(): number {
    return estimateItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  }

  function getEstimateBreakdown() {
    const subtotal = getEstimateGrandTotal();
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

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();

    const hasUnnamedCustomItem = estimateItems.some(
      (item) => item.category === "custom" && !item.customName.trim()
    );
    if (hasUnnamedCustomItem) {
      window.alert("Every custom budget entry needs a name.");
      return;
    }

    try {
      // Calculate budget from estimate (including markup, tax, servicing fee)
      const breakdown = getEstimateBreakdown();
      const budgetTotal = breakdown.total > 0 ? breakdown.total : getEstimateGrandTotal();

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProject,
          budget_amount: budgetTotal > 0 ? budgetTotal : null,
          funding_notes: budgetTotal > 0 ? `Estimate Total: $${budgetTotal.toLocaleString()}` : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const projectId = data.project.id;

        // Create estimate line items for the new project
        for (const item of estimateItems) {
          await fetch(`/api/projects/${projectId}/estimate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: item.category,
              custom_category_name: item.category === "custom" ? item.customName : undefined,
              description: item.description,
              price_rate: parseFloat(item.priceRate) || 0,
              quantity: parseFloat(item.quantity) || 1,
            }),
          });
        }

        setShowNewProject(false);
        setNewProject({
          name: "",
          description: "",
          status: "planning",
          address: "",
        });
        setEstimateItems([]);
        setSelectedCategories([]);
        setMarkupType("percentage");
        setMarkupValue("");
        setTaxRate("");
        setOnlineServicingFee(true);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  }

  async function handleDeleteProject(projectId: string) {
    if (!window.confirm("Delete this project? This cannot be undone.")) {
      return;
    }

    setDeletingProjectId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        window.alert(data.error || "Failed to delete project");
        return;
      }

      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setAssignments([]);
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      window.alert("Failed to delete project");
    } finally {
      setDeletingProjectId(null);
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

  const bonanStatusStyles: Record<BonanReportStatus, string> = {
    draft: "bg-amber-100 text-amber-700",
    submitted: "bg-green-100 text-green-700",
  };

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getWalkthroughCompletion(
    report: BonanHighlightReport | null,
    summary: BonanHighlightSummary | null
  ) {
    const explicitValue = report?.payload?.collectiveSummary?.dailyWalkthroughCompletion?.trim();
    if (explicitValue) return explicitValue;
    if (!summary) return "Not set";
    return `${summary.daily_reports.submitted}/${summary.daily_reports.due}`;
  }

  function getCheckupCompletion(
    report: BonanHighlightReport | null,
    mode: "weekly" | "monthly"
  ) {
    const summary = report?.payload?.collectiveSummary;
    if (!summary) return "Not set";

    const raw =
      mode === "weekly"
        ? summary.criticalCheckupsCompletion
        : summary.monthlyCheckupCompletion;
    const trimmed = raw?.trim();
    return trimmed || "Not set";
  }

  if (loading) {
    return <div className="text-(--text)">Loading...</div>;
  }

  const totalBudget = projects.reduce(
    (sum, p) => sum + (p.budget_amount || 0),
    0
  );
  const fundedProjects = projects.filter((p) => p.is_funded).length;
  const bonanLatestSummary = monthlySummary || weeklySummary;
  const bonanOpenWorkOrders = bonanLatestSummary
    ? bonanLatestSummary.work_orders.pending + bonanLatestSummary.work_orders.in_progress
    : 0;
  const bonanActiveIncidents = bonanLatestSummary
    ? bonanLatestSummary.incidents.open + bonanLatestSummary.incidents.in_progress
    : 0;

  return (
    <div className="space-y-3 md:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-(--text)">
            Admin Dashboard
          </h2>
          <p className="text-xs md:text-sm text-(--text) mt-1">
            Manage all projects, users, and assignments
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowNewProject(true)}
            className="flex-1 sm:flex-initial tl-btn px-4 md:px-6 py-2.5 text-sm"
          >
            + New Project
          </button>
        </div>
      </div>

      <div className="tl-card border border-cyan-200/80 bg-cyan-50/40 p-3 md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.15em] text-cyan-800/70">
              Bonan Towers Operations
            </p>
            <h3 className="text-sm md:text-base font-semibold text-cyan-950 mt-1">
              Weekly + Monthly Review Highlights
            </h3>
            <p className="text-xs text-cyan-900/75 mt-1">
              Work orders, incident reports, checkups, and daily walkthrough completion in one view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/bonan"
              className="rounded-full border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 transition"
            >
              Open Bonan Hub
            </Link>
            <Link
              href="/dashboard/bonan/daily"
              className="rounded-full border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 transition"
            >
              Daily Walkthroughs
            </Link>
            <Link
              href="/dashboard/bonan/weekly"
              className="rounded-full border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 transition"
            >
              Weekly
            </Link>
            <Link
              href="/dashboard/bonan/monthly"
              className="rounded-full border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 transition"
            >
              Monthly
            </Link>
          </div>
        </div>

        {bonanHighlightsError && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {bonanHighlightsError}
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
          <div className="rounded-xl border border-blue-200 bg-white/90 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Latest Weekly</p>
              {latestWeeklyReport && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    bonanStatusStyles[latestWeeklyReport.status]
                  }`}
                >
                  {latestWeeklyReport.status === "submitted" ? "Submitted" : "Draft"}
                </span>
              )}
            </div>
            {latestWeeklyReport ? (
              <>
                <p className="mt-1 text-xs font-medium text-slate-700">
                  {latestWeeklyReport.report_date} to {getWeekEndSaturday(latestWeeklyReport.report_date)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Work Orders: <strong>{weeklySummary?.work_orders.total ?? 0}</strong>
                  </p>
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Incidents: <strong>{weeklySummary?.incidents.total ?? 0}</strong>
                  </p>
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Checkups: <strong>{getCheckupCompletion(latestWeeklyReport, "weekly")}</strong>
                  </p>
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Walkthroughs: <strong>{getWalkthroughCompletion(latestWeeklyReport, weeklySummary)}</strong>
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Updated {formatUsCentralDateTime(latestWeeklyReport.updated_at)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No weekly report available yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-orange-200 bg-white/90 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Latest Monthly</p>
              {latestMonthlyReport && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    bonanStatusStyles[latestMonthlyReport.status]
                  }`}
                >
                  {latestMonthlyReport.status === "submitted" ? "Submitted" : "Draft"}
                </span>
              )}
            </div>
            {latestMonthlyReport ? (
              <>
                <p className="mt-1 text-xs font-medium text-slate-700">{getMonthKey(latestMonthlyReport.report_date)}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Work Orders: <strong>{monthlySummary?.work_orders.total ?? 0}</strong>
                  </p>
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Incidents: <strong>{monthlySummary?.incidents.total ?? 0}</strong>
                  </p>
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Checkups: <strong>{getCheckupCompletion(latestMonthlyReport, "monthly")}</strong>
                  </p>
                  <p className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                    Walkthroughs: <strong>{getWalkthroughCompletion(latestMonthlyReport, monthlySummary)}</strong>
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Updated {formatUsCentralDateTime(latestMonthlyReport.updated_at)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No monthly report available yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-2 md:gap-3">
        <div className="tl-card p-3 md:p-5">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em] text-(--text)">
            Total Projects
          </p>
          <Link
            href="/dashboard/projects"
            className="mt-1 md:mt-2 inline-block text-2xl md:text-3xl font-semibold text-blue-700 hover:underline"
          >
            {projects.length}
          </Link>
        </div>
        <div className="tl-card p-3 md:p-5">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em] text-(--text)">
            Active Projects
          </p>
          <Link
            href="/dashboard/projects?status=in_progress"
            className="mt-1 md:mt-2 inline-block text-2xl md:text-3xl font-semibold text-blue-700 hover:underline"
          >
            {projects.filter((p) => p.status === "in_progress").length}
          </Link>
        </div>
        <div className="tl-card p-3 md:p-5">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em] text-(--text)">
            Total Budget
          </p>
          <Link
            href="/dashboard/projects"
            className="mt-1 md:mt-2 inline-block text-lg md:text-2xl font-semibold text-blue-700 hover:underline"
          >
            {formatCurrency(totalBudget)}
          </Link>
        </div>
        <div className="tl-card p-3 md:p-5">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em] text-(--text)">
            Funded Projects
          </p>
          <Link
            href="/dashboard/projects"
            className="mt-1 md:mt-2 inline-flex items-baseline gap-0.5 text-2xl md:text-3xl font-semibold text-blue-700 hover:underline"
          >
            {fundedProjects}
            <span className="text-sm md:text-lg text-blue-700">
              /{projects.length}
            </span>
          </Link>
        </div>
        <div className="tl-card p-3 md:p-5">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em] text-(--text)">
            Bonan Approval / Active WOs
          </p>
          <Link
            href="/dashboard/management?tab=work-orders&site=bonan_towers&statuses=pending%2Cin_progress"
            className="mt-1 md:mt-2 inline-block text-2xl md:text-3xl font-semibold text-blue-700 hover:underline"
          >
            {bonanOpenWorkOrders}
          </Link>
        </div>
        <div className="tl-card p-3 md:p-5">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em] text-(--text)">
            Bonan Approval / Active Incidents
          </p>
          <Link
            href="/dashboard/management?tab=incident-reports&site=bonan_towers&incidentStatus=open%2Cin_progress"
            className="mt-1 md:mt-2 inline-block text-2xl md:text-3xl font-semibold text-blue-700 hover:underline"
          >
            {bonanActiveIncidents}
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
        {/* Projects List */}
        <div className="tl-card p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-(--text) mb-3 md:mb-4">
            All Projects
          </h3>
          {projects.length === 0 ? (
            <p className="text-sm text-(--text)">
              No projects yet. Create your first project.
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] md:max-h-[500px] overflow-y-auto -mx-2 px-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`relative p-3 md:p-4 rounded-xl border-2 transition shadow-sm ${
                    statusCardStyles[project.status] || statusCardStyles.planning
                  } ${
                    selectedProject?.id === project.id
                      ? "border-blue-500 bg-blue-50/50 shadow-lg ring-2 ring-blue-500/20"
                      : "border-(--border) hover:border-(--border) hover:shadow-md bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(project.id)}
                    disabled={deletingProjectId === project.id}
                    className="absolute right-2 top-2 h-7 w-7 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-60"
                    title="Delete project"
                    aria-label={`Delete ${project.name}`}
                  >
                    {deletingProjectId === project.id ? "..." : "X"}
                  </button>
                  <div
                    onClick={() => handleSelectProject(project)}
                    className="cursor-pointer pr-8"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-(--text) text-sm md:text-base line-clamp-2">
                          {project.name}
                        </p>
                        {project.description && (
                          <p className="text-xs md:text-sm text-(--text) mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 text-[10px] md:text-xs px-2 py-1 rounded-full whitespace-nowrap font-medium ${
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
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="line-clamp-1">{project.on_hold_reason}</span>
                        </div>
                      </div>
                    )}

                    {/* Budget & Funding Row */}
                    <div className="flex items-center gap-3 md:gap-4 mt-3 text-xs">
                      {project.budget_amount ? (
                        <span className="text-(--text) font-semibold">
                          {formatCurrency(project.budget_amount)}
                        </span>
                      ) : (
                        <span className="text-(--text)">
                          No budget
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            project.is_funded ? "bg-green-500" : "bg-yellow-500"
                          }`}
                        />
                        <span className="text-(--text) font-medium">
                          {project.is_funded ? "Funded" : "Pending"}
                        </span>
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
          )}
        </div>

        {/* Project Details & Assignments */}
        <div className="tl-card p-4 md:p-6">
          {selectedProject ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-(--text)">
                  {selectedProject.name} - Assignments
                </h3>
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

              {/* Quick Budget Info */}
              <div className="p-3 rounded-lg bg-(--bg) mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-(--text)">Budget:</span>
                  <span className="font-medium text-(--text)">
                    {selectedProject.budget_amount
                      ? formatCurrency(selectedProject.budget_amount)
                      : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-(--text)">Status:</span>
                  <span className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedProject.is_funded
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                    />
                    <span className="font-medium text-(--text)">
                      {selectedProject.is_funded ? "Funded" : "Pending Funding"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.2em] text-(--text) mb-3">
                  Currently Assigned
                </p>
                {assignments.length === 0 ? (
                  <p className="text-sm text-(--text)">
                    No users assigned yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Group by role */}
                    {["admin", "employee", "client"].map((role) => {
                      const roleAssignments = assignments.filter((a) => a.role === role);
                      if (roleAssignments.length === 0) return null;
                      const roleLabel = role === "admin" ? "Admins" : role === "employee" ? "Employees" : "Clients";
                      const roleColor = role === "admin" ? "bg-purple-100 text-purple-700 border-purple-200" : role === "employee" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-green-100 text-green-700 border-green-200";
                      return (
                        <div key={role}>
                          <p className={`text-xs font-semibold mb-2 px-2 py-1 rounded-md inline-block ${roleColor}`}>
                            {roleLabel} ({roleAssignments.length})
                          </p>
                          <div className="space-y-2">
                            {roleAssignments.map((a) => (
                              <div
                                key={a.user_id}
                                className="flex items-center justify-between p-3 rounded-lg bg-(--bg)"
                              >
                                <div>
                                  <p className="text-sm font-medium text-(--text)">
                                    {a.first_name} {a.last_name}
                                  </p>
                                  <p className="text-xs text-(--text)">
                                    {a.email}
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-(--text) mb-3">
                  Add User
                </p>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {/* Group available users by role */}
                  {["admin", "employee", "client"].map((role) => {
                    const availableUsers = users.filter((u) => u.role === role && !assignments.some((a) => a.user_id === u.id));
                    if (availableUsers.length === 0) return null;
                    const roleLabel = role === "admin" ? "Admins" : role === "employee" ? "Employees" : "Clients";
                    const roleColor = role === "admin" ? "bg-purple-100 text-purple-700 border-purple-200" : role === "employee" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-green-100 text-green-700 border-green-200";
                    const borderColor = role === "admin" ? "border-purple-200 hover:border-purple-300" : role === "employee" ? "border-blue-200 hover:border-blue-300" : "border-green-200 hover:border-green-300";
                    return (
                      <div key={role}>
                        <p className={`text-xs font-semibold mb-2 px-2 py-1 rounded-md inline-block ${roleColor}`}>
                          {roleLabel} ({availableUsers.length})
                        </p>
                        <div className="space-y-2">
                          {availableUsers.map((user) => (
                            <div
                              key={user.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${borderColor} transition`}
                            >
                              <div>
                                <p className="text-sm font-medium text-(--text)">
                                  {user.first_name} {user.last_name}
                                </p>
                                <p className="text-xs text-(--text)">
                                  {user.email}
                                </p>
                              </div>
                              <button
                                onClick={() => handleAssignUser(user.id)}
                                className="text-xs px-3 py-1 rounded-full bg-(--bg) hover:bg-(--bg)/80 text-(--text) font-medium transition"
                              >
                                + Assign
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-(--text)">
                Select a project to manage assignments
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="tl-card p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-(--text) mb-3 md:mb-4">
          All Users ({users.length})
        </h3>
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="text-left text-[10px] md:text-xs uppercase tracking-[0.15em] md:tracking-[0.2em] text-(--text)">
                <th className="pb-3">Name</th>
                <th className="pb-3 hidden sm:table-cell">Email</th>
                <th className="pb-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--divide)">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 text-xs md:text-sm text-(--text)">
                    <div>{user.first_name} {user.last_name}</div>
                    <div className="text-[10px] text-(--text) sm:hidden">{user.email}</div>
                  </td>
                  <td className="py-3 text-sm text-(--text) hidden sm:table-cell">
                    {user.email}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-[10px] md:text-xs px-2 py-1 rounded-full ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : user.role === "employee"
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
        <ModalLayer align="sheet" className="bg-black/50" onBackdropClick={() => setShowNewProject(false)}>
          <div
            className="tl-card p-4 md:p-8 w-full max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl rounded-b-none md:rounded-b-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg md:text-xl font-semibold text-(--text) mb-4 md:mb-6">
              Create New Project
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-2">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-2">
                  Address
                </label>
                <AddressAutocomplete
                  value={newProject.address}
                  onChange={(value) =>
                    setNewProject({ ...newProject, address: value })
                  }
                  placeholder="Start typing an address..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-2">
                  Status
                </label>
                <select
                  value={newProject.status}
                  onChange={(e) =>
                    setNewProject({ ...newProject, status: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Estimate Builder */}
              <div className="pt-4 border-t border-(--border)">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-(--text)">
                    Estimate Builder
                  </p>
                  {getEstimateGrandTotal() > 0 && (
                    <p className="text-lg font-bold text-(--text)">
                      {formatCurrency(getEstimateBreakdown().total)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-(--text) mb-4">
                  Select line items to build the project estimate
                </p>

                {/* Category Checkboxes */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {PREDEFINED_CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                        selectedCategories.includes(cat)
                          ? "border-blue-400 bg-blue-50"
                          : "border-(--border) hover:bg-(--bg)"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                        className="h-4 w-4"
                      />
                      <span className="text-(--text)">{cat}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => addCustomLineItem()}
                    className="rounded-xl border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100"
                  >
                    + Add Custom Budget Entry
                  </button>
                  {customEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => addCustomLineItem(entry)}
                      className="rounded-xl border border-(--border) bg-white px-3 py-2 text-xs text-(--text) hover:bg-(--bg)"
                      title={entry.description || entry.name}
                    >
                      + {entry.name}
                    </button>
                  ))}
                </div>

                {/* Line Items */}
                {estimateItems.length > 0 && (
                  <div className="space-y-4">
                    {estimateItems.map((item, idx) => (
                      <div
                        key={`${item.category}-${idx}`}
                        className="p-3 rounded-xl border border-(--border) bg-(--bg) space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-(--text)">
                            {item.category === "custom" ? (
                              <input
                                type="text"
                                value={item.customName}
                                onChange={(e) => updateEstimateItem(idx, "customName", e.target.value)}
                                placeholder="Custom category name"
                                className="px-2 py-1 rounded-lg border border-(--border) bg-white text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring) w-48"
                              />
                            ) : (
                              item.category
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-(--text)">
                              {formatCurrency(getItemTotal(item))}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeEstimateItem(idx)}
                              className="h-7 w-7 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50"
                              title="Remove line item"
                              aria-label="Remove line item"
                            >
                              X
                            </button>
                          </div>
                        </div>
                        <div>
                          <textarea
                            value={item.description}
                            onChange={(e) => updateEstimateItem(idx, "description", e.target.value)}
                            rows={2}
                            placeholder="Description - details about this line item..."
                            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-white text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-(--text) mb-1">
                              Price Rate ($)
                            </label>
                            <input
                              type="number"
                              value={item.priceRate}
                              onChange={(e) => updateEstimateItem(idx, "priceRate", e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 rounded-lg border border-(--border) bg-white text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-(--text) mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateEstimateItem(idx, "quantity", e.target.value)}
                              placeholder="1"
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 rounded-lg border border-(--border) bg-white text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
                            />
                          </div>
                        </div>
                        {item.category === "custom" && (
                          <button
                            type="button"
                            onClick={() => handleSaveCustomEntry(idx)}
                            disabled={savingCustomEntryIndex === idx}
                            className="rounded-lg border border-(--border) bg-white px-3 py-1.5 text-xs font-medium text-(--text) hover:bg-(--bg) disabled:opacity-60"
                          >
                            {savingCustomEntryIndex === idx
                              ? "Saving..."
                              : "Save Entry for Future Projects"}
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Subtotal */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-(--tl-sand)">
                      <p className="text-sm font-semibold text-(--tl-navy)">Subtotal</p>
                      <p className="text-lg font-bold text-(--tl-navy)">
                        {formatCurrency(getEstimateGrandTotal())}
                      </p>
                    </div>

                    {/* Markup */}
                    <div className="p-3 rounded-xl border border-(--border) space-y-2">
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

                    {/* Tax */}
                    <div className="p-3 rounded-xl border border-(--border) space-y-2">
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

                    {/* Online Servicing Fee */}
                    <div className="p-3 rounded-xl border border-(--border)">
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

                    {/* Grand Total */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-900 text-white">
                      <p className="text-sm font-semibold">Estimate Total</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(getEstimateBreakdown().total)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 tl-btn px-4 py-2.5 text-sm"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
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
