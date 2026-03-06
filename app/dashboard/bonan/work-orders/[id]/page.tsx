"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BonanReadOnlyData from "@/app/components/BonanReadOnlyData";
import BonanClientActionPanel from "@/app/components/BonanClientActionPanel";

interface WorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  time_received: string | null;
  location: string | null;
  unit: string | null;
  area: string | null;
  priority: string;
  service_type: string;
  description: string;
  work_completed: string;
  work_summary: string | null;
  publication_status: string;
  updated_at: string;
}

export default function BonanClientWorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
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
          router.push(`/dashboard/management/work-orders/${id}`);
          return;
        }

        const res = await fetch(`/api/bonan/client/work-orders/${id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to load Bonan work order.");
          return;
        }

        setWorkOrder(data.workOrder || null);
      } catch (fetchError) {
        console.error("Failed to load Bonan work order:", fetchError);
        setError("Failed to load Bonan work order.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [id, router]);

  const fieldValues = useMemo<Record<string, string>>(
    () => ({
      location: workOrder?.location || "",
      area: workOrder?.area || "",
      description: workOrder?.description || "",
      work_summary: workOrder?.work_summary || "",
      work_completed: workOrder?.work_completed || "",
    }),
    [workOrder]
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-(--text)">Loading...</div>;
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-(--bg)">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "Work order unavailable."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <header className="rounded-2xl border border-(--border)/20 bg-white/90 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-(--text)/55">Bonan Towers Work Order</p>
              <h1 className="text-2xl font-bold text-(--text) mt-1">{workOrder.work_order_number}</h1>
              <p className="text-sm text-(--text)/60 mt-1">
                Updated {new Date(workOrder.updated_at).toLocaleString()}
              </p>
            </div>
            <Link href="/dashboard/bonan/work-orders" className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text)">
              Back
            </Link>
          </div>
        </header>

        <BonanReadOnlyData
          title="Work Order Summary"
          value={{
            date: workOrder.date,
            time_received: workOrder.time_received,
            location: workOrder.location,
            unit: workOrder.unit,
            area: workOrder.area,
            priority: workOrder.priority,
            service_type: workOrder.service_type,
            status: workOrder.work_completed,
            description: workOrder.description,
            work_summary: workOrder.work_summary,
          }}
        />

        <BonanClientActionPanel
          entityType="work_order"
          entityId={workOrder.id}
          defaultArea={workOrder.area || workOrder.location || "Bonan Towers"}
          currentFieldValues={fieldValues}
          fieldOptions={[
            { value: "location", label: "Location" },
            { value: "area", label: "Area" },
            { value: "description", label: "Description" },
            { value: "work_summary", label: "Work Summary" },
            { value: "work_completed", label: "Status" },
          ]}
        />
      </div>
    </div>
  );
}
