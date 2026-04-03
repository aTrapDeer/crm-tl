"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClientDashboard() {
  const router = useRouter();
  const [hasBonan, setHasBonan] = useState(false);

  useEffect(() => {
    fetch("/api/bonan/clients")
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return { memberships: [] };
      })
      .then((data) => {
        if (data.memberships && data.memberships.length > 0) {
          setHasBonan(true);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-semibold text-(--text)">
          Client Dashboard
        </h2>
        <p className="text-sm md:text-base text-(--text)/80 mt-2">
          Select a portal to view your projects or access your Bonan Towers review hub.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Projects Button */}
        <button
          onClick={() => router.push("/dashboard/client/projects")}
          className="group relative flex flex-col items-start p-8 rounded-3xl border border-(--border) bg-(--bg) shadow-sm hover:shadow-xl transition-all duration-300 text-left overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex-none w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>

          <h3 className="text-2xl font-bold text-(--text) mb-3">Projects & Documents</h3>
          <p className="text-(--text)/70">
            View your active projects, track progress, and access shared documents and files.
          </p>
          
          <div className="mt-8 flex items-center text-blue-600 font-medium">
            Open Projects
            <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </button>

        {/* Bonan Towers Button */}
        {hasBonan && (
          <button
            onClick={() => router.push("/dashboard/bonan")}
            className="group relative flex flex-col items-start p-8 rounded-3xl border border-blue-200 bg-[linear-gradient(135deg,#01224f_0%,#0d3e8d_55%,#1f4faa_100%)] shadow-[0_20px_40px_rgba(1,34,79,0.25)] hover:shadow-[0_20px_40px_rgba(1,34,79,0.4)] transition-all duration-300 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex-none w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-white/10 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <p className="text-xs uppercase tracking-[0.28em] text-white/70 mb-2">Bonan Towers</p>
            <h3 className="text-2xl font-bold text-white mb-3">Client Review Hub</h3>
            <p className="text-white/80">
              Review published work orders, incidents, walkthroughs, and approvals in one simple place.
            </p>

            <div className="mt-8 flex items-center text-white font-medium">
              Open Bonan Hub
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
