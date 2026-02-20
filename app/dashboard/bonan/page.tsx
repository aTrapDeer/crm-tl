"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BonanDashboardPage() {
  const router = useRouter();
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
        if (data.user.role === "client") {
          router.push("/dashboard");
          return;
        }
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

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-(--text)/55">
            Bonan Towers
          </p>
          <h1 className="text-2xl font-bold text-(--text)">Bonan Operations</h1>
          <p className="text-sm text-(--text)/60 mt-1">
            Dedicated reporting systems for daily, weekly, and monthly compliance workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/bonan/daily"
            className="tl-card p-5 border border-emerald-200 bg-emerald-50/70 hover:shadow-lg transition"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Active</p>
            <h2 className="text-lg font-semibold text-emerald-950 mt-2">Daily Walk-Throughs</h2>
            <p className="text-sm text-emerald-900/80 mt-2">
              Coverage matrix, life safety, incident/alarm, fridge and fire alarm logs.
            </p>
          </Link>

          <Link
            href="/dashboard/bonan/weekly"
            className="tl-card p-5 border border-slate-200 bg-slate-50/70 hover:shadow-lg transition"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Next</p>
            <h2 className="text-lg font-semibold text-slate-900 mt-2">Weekly Systems</h2>
            <p className="text-sm text-slate-700/80 mt-2">
              Sprinkler pump test logs and daily rollup linkage.
            </p>
          </Link>

          <Link
            href="/dashboard/bonan/monthly"
            className="tl-card p-5 border border-slate-200 bg-slate-50/70 hover:shadow-lg transition"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Upcoming</p>
            <h2 className="text-lg font-semibold text-slate-900 mt-2">Monthly Closeout</h2>
            <p className="text-sm text-slate-700/80 mt-2">
              Deficiency register, compliance checks, and executive certification.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
