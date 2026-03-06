"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface WorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  area: string | null;
  location: string | null;
  description: string;
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
}

export default function BonanClientWorkOrdersPage() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          router.push("/login");
          return;
        }

        if (sessionData.user.role !== "client") {
          router.push("/dashboard/management?tab=work-orders&site=bonan_towers");
          return;
        }

        const res = await fetch("/api/bonan/client/work-orders");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to load Bonan work orders.");
          return;
        }

        setWorkOrders(data.workOrders || []);
      } catch (fetchError) {
        console.error("Failed to load Bonan work orders:", fetchError);
        setError("Failed to load Bonan work orders.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [router]);

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--text)/55">Bonan Towers</p>
            <h1 className="text-2xl font-bold text-(--text)">Published Work Orders</h1>
            <p className="text-sm text-(--text)/60 mt-1">Review work completed, approval status, and any follow-up notes.</p>
          </div>
          <Link href="/dashboard/bonan" className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text)">
            Back to Bonan
          </Link>
        </div>

        {loading ? (
          <div className="tl-card p-6 text-sm text-(--text)/60">Loading work orders...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : workOrders.length === 0 ? (
          <div className="tl-card p-6 text-sm text-(--text)/60">No published Bonan work orders are available yet.</div>
        ) : (
          <div className="space-y-3">
            {workOrders.map((workOrder) => (
              <Link key={workOrder.id} href={`/dashboard/bonan/work-orders/${workOrder.id}`} className="block rounded-2xl border border-(--border)/20 bg-white/90 p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-(--text)">{workOrder.work_order_number}</p>
                    <p className="text-sm text-(--text)/70 mt-1">{workOrder.description}</p>
                    <p className="text-xs text-(--text)/55 mt-2">
                      {[workOrder.date, workOrder.location, workOrder.area].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize">
                    {workOrder.work_completed.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
