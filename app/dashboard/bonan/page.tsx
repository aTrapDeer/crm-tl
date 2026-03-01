"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UserRole = "admin" | "employee" | "client";

export default function BonanDashboardPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!data.user) {
          router.push("/login");
          return;
        }
        setUserRole(data.user.role as UserRole);
      } catch {
        router.push("/login");
        return;
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  const showChecklistWorkflows = userRole !== "client";
  const showReviewWorkflows = userRole !== "employee";
  const monthlyLogsHref = userRole === "client"
    ? "/dashboard/bonan/monthly-summaries"
    : "/dashboard/bonan/monthly";

  const accessMode =
    userRole === "client"
      ? "Client Review"
      : userRole === "employee"
        ? "Employee Execution"
        : "Admin Full Access";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-3 md:px-4 lg:px-6 py-6 md:py-8 space-y-6">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Bonan Towers
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Operations Hub</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
            <p className="text-base text-slate-600 max-w-2xl">
              Centralized dashboard for tracking facility operations, from daily walkthroughs to comprehensive monthly reviews.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span className="text-xs font-semibold text-slate-700">Access Mode: {accessMode}</span>
            </div>
          </div>
        </div>

        {/* Informational Banners */}
        {showChecklistWorkflows && !showReviewWorkflows && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 flex gap-3 shadow-sm">
            <div className="mt-0.5 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Execution Mode Active</p>
              <p className="mt-1 text-sm text-emerald-700">Focus on Daily to Weekly to Monthly Checklist completion workflow.</p>
            </div>
          </div>
        )}

        {showReviewWorkflows && !showChecklistWorkflows && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 flex gap-3 shadow-sm">
            <div className="mt-0.5 text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">Review Mode Active</p>
              <p className="mt-1 text-sm text-blue-700">Focus on the Monthly Summary first, then drill down into Weekly and Daily links.</p>
            </div>
          </div>
        )}

        {/* Core Operations Section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Core Monthly Cycle</h2>
          </div>
          <p className="text-sm text-slate-600 mb-6 max-w-3xl">
            Manage the complete monthly workflow: execute your checklist work orders and review the comprehensive month-wide summary that integrates all daily logs, weekly checks, and incidents.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Link
              href="/dashboard/bonan/monthly"
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-blue-500 hover:ring-1 hover:ring-blue-500 hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-6 pb-0 flex-1">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600 transition-colors">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Checklist Work Orders</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Execute and track monthly preventive maintenance tasks, inspections, and assigned work orders.
                </p>
              </div>
              <div className="p-6 pt-5">
                <div className="tl-btn w-full sm:w-fit px-5 py-2.5 text-sm">
                  Open Checklists
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </Link>

            <Link
              href={monthlyLogsHref}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-blue-500 hover:ring-1 hover:ring-blue-500 hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-6 pb-0 flex-1">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600 transition-colors">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Monthly Summary</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Review the connected month view tying all operations, daily logs, and weekly checks together.
                </p>
              </div>
              <div className="p-6 pt-5">
                <div className="tl-btn w-full sm:w-fit px-5 py-2.5 text-sm">
                  {userRole === "client" ? "Open Summaries" : "Open Monthly"}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Full Scope Section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Activity Logs & Data</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Daily Card */}
            <div className="group rounded-2xl border border-slate-200 bg-slate-50 flex flex-col hover:border-slate-300 hover:shadow-md transition-all overflow-hidden">
              <div className="p-5 flex-1 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-100/50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Daily Logs</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Frontline checklist entries, walkthroughs, and shift follow-up records.
                </p>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 group-hover:bg-indigo-50/30 transition-colors">
                <Link 
                  href="/dashboard/bonan/daily" 
                  className="flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-700 transition-all"
                >
                  View Daily
                  <svg className="ml-1.5 h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Weekly Card */}
            <div className="group rounded-2xl border border-slate-200 bg-slate-50 flex flex-col hover:border-slate-300 hover:shadow-md transition-all overflow-hidden">
              <div className="p-5 flex-1 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center ring-1 ring-teal-100/50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Weekly Checks</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Weekly systems logs, detailed reviews, and linked daily rollups.
                </p>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 group-hover:bg-teal-50/30 transition-colors">
                <Link 
                  href="/dashboard/bonan/weekly" 
                  className="flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 shadow-sm group-hover:border-teal-200 group-hover:text-teal-700 transition-all"
                >
                  View Weekly
                  <svg className="ml-1.5 h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Monthly Card */}
            <div className="group rounded-2xl border border-slate-200 bg-slate-50 flex flex-col hover:border-slate-300 hover:shadow-md transition-all overflow-hidden">
              <div className="p-5 flex-1 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center ring-1 ring-blue-100/50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Monthly Logs</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Comprehensive month-wide records integrating all prior activity.
                </p>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 group-hover:bg-blue-50/30 transition-colors">
                <Link 
                  href={monthlyLogsHref}
                  className="flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 shadow-sm group-hover:border-blue-200 group-hover:text-blue-700 transition-all"
                >
                  View Monthly
                  <svg className="ml-1.5 h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
