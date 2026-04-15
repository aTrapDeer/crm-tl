"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUsCentralDateTime } from "@/lib/us-central-time";

interface ClientDecision {
  decision_status: "approved" | "denied";
  responded_at: string;
}

interface WorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  area: string | null;
  location: string | null;
  description: string;
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  client_decision: ClientDecision | null;
}

function formatWorkOrderStatusLabel(status: WorkOrder["work_completed"]) {
  if (status === "pending") return "Approval Needed";
  return status.replace(/_/g, " ");
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
            <h1 className="text-2xl font-bold text-(--text)">Bonan Work Orders</h1>
            <p className="text-sm text-(--text)/60 mt-1">Review approval-needed drafts plus any work orders that have already been published to the client portal.</p>
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
          <div className="tl-card p-6 text-sm text-(--text)/60">No Bonan work orders are available for client review yet.</div>
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
                    {workOrder.client_decision ? (
                      <p className="mt-2 text-xs text-(--text)/55">
                        {workOrder.client_decision.decision_status === "approved" ? "Client approved" : "Client denied"}{" "}
                        {formatUsCentralDateTime(workOrder.client_decision.responded_at)} CT
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize">
                      {formatWorkOrderStatusLabel(workOrder.work_completed)}
                    </span>
                    {workOrder.client_decision ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          workOrder.client_decision.decision_status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {workOrder.client_decision.decision_status === "approved" ? "Client approved" : "Client denied"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
