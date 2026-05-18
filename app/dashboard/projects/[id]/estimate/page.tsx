"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import EstimateViewer from "@/app/components/EstimateViewer";
import type { EstimateLineItem } from "@/lib/projects";
import type { EstimateSettingsInput } from "@/lib/estimate";
import { DEFAULT_ESTIMATE_SETTINGS } from "@/lib/estimate";

interface EstimateResponse {
  items: EstimateLineItem[];
  total: number;
  settings?: EstimateSettingsInput;
  delivery_id?: string;
  tracking_token?: string;
  sent_at?: string;
  estimate_sent?: boolean;
  hide_line_item_prices_for_client?: boolean;
  hide_markup_for_client?: boolean;
  error?: string;
}

export default function ProjectEstimatePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const deliveryToken = searchParams.get("delivery");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<{
    name: string;
    address: string | null;
    hide_line_item_prices_for_client: boolean;
    hide_markup_for_client: boolean;
  } | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [clientInfo, setClientInfo] = useState({ name: "Project Client", email: "" });
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const [projectRes, sessionRes, estimateRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch("/api/auth/session"),
          fetch(`/api/projects/${projectId}/estimate`),
        ]);

        if (!projectRes.ok) {
          router.push("/dashboard");
          return;
        }

        const projectData = await projectRes.json();
        const sessionData = await sessionRes.json();
        const estimateData: EstimateResponse = await estimateRes.json();

        setUserRole(sessionData.user?.role || "");
        setProject(projectData.project);

        if (!estimateRes.ok) {
          setError(estimateData.error || "Estimate not available");
          setLoading(false);
          return;
        }

        setEstimate(estimateData);

        if (sessionData.user?.role === "client") {
          setClientInfo({
            name: `${sessionData.user.first_name || ""} ${sessionData.user.last_name || ""}`.trim() || "Client",
            email: sessionData.user.email || "",
          });
        }

        await fetch(`/api/projects/${projectId}/estimate/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delivery_token: deliveryToken || estimateData.tracking_token }),
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load estimate");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [projectId, deliveryToken, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--tl-navy) border-t-transparent" />
      </div>
    );
  }

  if (error || !project || !estimate) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-semibold text-(--text)">Estimate Not Available</h1>
        <p className="mt-2 text-(--text)/70">
          {error || "This estimate has not been sent yet or you do not have access."}
        </p>
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="tl-btn mt-6 inline-block px-6 py-2.5 text-sm"
        >
          Back to Project
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="text-sm text-(--tl-royal) hover:underline"
        >
          ← Back to {project.name}
        </Link>
        {userRole === "admin" && (
          <button
            onClick={() => window.open(`/api/projects/${projectId}/export-pdf`, "_blank")}
            className="rounded-full border border-(--border) px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg)"
          >
            Export PDF
          </button>
        )}
      </div>

      <EstimateViewer
        projectName={project.name}
        projectAddress={project.address}
        clientName={clientInfo.name}
        clientEmail={clientInfo.email}
        lineItems={estimate.items}
        settings={estimate.settings || DEFAULT_ESTIMATE_SETTINGS}
        grandTotal={estimate.total}
        hideLineItemPricing={estimate.hide_line_item_prices_for_client}
        hideMarkup={estimate.hide_markup_for_client}
        sentAt={estimate.sent_at}
      />
    </div>
  );
}
