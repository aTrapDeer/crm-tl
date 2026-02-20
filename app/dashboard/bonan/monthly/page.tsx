"use client";

import Link from "next/link";

export default function BonanMonthlyPage() {
  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-(--text)/55">Bonan Towers</p>
        <h1 className="text-2xl font-bold text-(--text)">Monthly Systems</h1>
        <div className="tl-card p-6">
          <p className="text-sm text-(--text)/70">
            Monthly systems will cover compliance closeout, deficiency register, extinguisher/egress checks, and linked weekly/daily overview.
          </p>
          <Link
            href="/dashboard/bonan/daily"
            className="inline-flex mt-4 rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
          >
            Open Daily Reports
          </Link>
        </div>
      </div>
    </div>
  );
}
