"use client";

import { useEffect, useMemo, useState } from "react";
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

const statusConfig: Record<
  string,
  { label: string; badge: string; dot: string; ring: string }
> = {
  planning: {
    label: "Planning",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    ring: "ring-slate-200/80",
  },
  in_progress: {
    label: "In Progress",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    ring: "ring-blue-200/80",
  },
  on_hold: {
    label: "On Hold",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-200/80",
  },
  completed: {
    label: "Completed",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200/80",
  },
};

const statusFilters = [
  { key: "all", label: "All" },
  { key: "planning", label: "Planning" },
  { key: "in_progress", label: "In Progress" },
  { key: "on_hold", label: "On Hold" },
  { key: "completed", label: "Completed" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeline(project: Project) {
  if (!project.start_date && !project.end_date) return "TBD";
  return `${formatDate(project.start_date)} → ${formatDate(project.end_date)}`;
}

export default function ProjectsHubPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  useEffect(() => {
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

    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      const matchesQuery =
        !lowerQuery ||
        project.name.toLowerCase().includes(lowerQuery) ||
        (project.description || "").toLowerCase().includes(lowerQuery) ||
        (project.address || "").toLowerCase().includes(lowerQuery);
      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    const sorted = [...filtered];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "budget") {
      sorted.sort((a, b) => (b.budget_amount || 0) - (a.budget_amount || 0));
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return sorted;
  }, [projects, query, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "in_progress").length;
    const onHold = projects.filter((p) => p.status === "on_hold").length;
    const funded = projects.filter((p) => p.is_funded).length;
    return { total, active, onHold, funded };
  }, [projects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--border)" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-[linear-gradient(135deg,#01224f_0%,#0d3e8d_55%,#1f4faa_100%)] px-6 py-6 md:px-10 md:py-8 text-white shadow-[0_30px_60px_rgba(1,34,79,0.35)]">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.5),rgba(1,183,231,0))]" />
        <div className="absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.45),rgba(123,168,179,0))]" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/70">
              Projects Hub
            </p>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold">
              Everything in motion, all in one row.
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/80 max-w-2xl">
              Scan the full portfolio, filter by stage, and open any project
              in a fresh detail page without losing your place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em]">
                Total
              </p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em]">
                Active
              </p>
              <p className="text-2xl font-semibold">{stats.active}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em]">
                On Hold
              </p>
              <p className="text-2xl font-semibold">{stats.onHold}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em]">
                Funded
              </p>
              <p className="text-2xl font-semibold">{stats.funded}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tl-card p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 text-(--text)/60 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, addresses, descriptions"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
            >
              <option value="recent">Newest</option>
              <option value="name">Name</option>
              <option value="budget">Budget</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const active = statusFilter === filter.key;
            return (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                  active
                    ? "bg-(--text) text-white"
                    : "bg-(--bg) text-(--text) hover:bg-(--bg)/60"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="hidden md:grid md:grid-cols-[1.6fr_1.1fr_1fr_1.2fr_auto] gap-4 px-4 text-[11px] uppercase tracking-[0.28em] text-(--text)/60">
          <span>Project</span>
          <span>Timeline</span>
          <span>Budget & Funding</span>
          <span>Location</span>
          <span className="text-right">Open</span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="tl-card p-10 text-center">
            <p className="text-(--text) font-medium">No projects found</p>
            <p className="text-sm text-(--text) mt-2">
              Try a different search or reset the filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map((project) => {
              const status = statusConfig[project.status] || statusConfig.planning;
              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block group"
                  aria-label={`Open ${project.name} in a new tab`}
                >
                  <div className={`tl-card p-4 md:p-5 ring-1 ${status.ring} hover:shadow-[0_30px_60px_rgba(1,34,79,0.2)] transition`}>
                    <div className="grid gap-4 md:grid-cols-[1.6fr_1.1fr_1fr_1.2fr_auto] md:items-center">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
                          <h3 className="text-base font-semibold text-(--text)">
                            {project.name}
                          </h3>
                          <span className={`text-[11px] px-2 py-1 rounded-full ${status.badge}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-(--text) line-clamp-2">
                          {project.description || "No description provided yet."}
                        </p>
                        {project.status === "on_hold" && project.on_hold_reason && (
                          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {project.on_hold_reason}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 text-sm text-(--text)">
                        <p className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
                          Timeline
                        </p>
                        <p className="font-medium">{formatTimeline(project)}</p>
                        {project.expected_resume_date && (
                          <p className="text-xs text-(--text)/70">
                            Resume: {formatDate(project.expected_resume_date)}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 text-sm text-(--text)">
                        <p className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
                          Budget
                        </p>
                        <p className="font-semibold">
                          {project.budget_amount
                            ? formatCurrency(project.budget_amount)
                            : "Not set"}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              project.is_funded ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          <span className="text-(--text)">
                            {project.is_funded ? "Funded" : "Funding pending"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-(--text)">
                        <p className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
                          Location
                        </p>
                        <p className="font-medium">
                          {project.address || "Address to be confirmed"}
                        </p>
                      </div>

                      <div className="flex md:justify-end">
                        <div className="flex items-center gap-2 text-sm font-medium text-(--text) group-hover:text-(--tl-royal)">
                          Open
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
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
