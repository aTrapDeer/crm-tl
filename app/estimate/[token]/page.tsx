"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import EstimateViewer from "@/app/components/EstimateViewer";
import type { EstimateLineItem } from "@/lib/projects";
import type { EstimateSettingsInput } from "@/lib/estimate";
import { DEFAULT_ESTIMATE_SETTINGS } from "@/lib/estimate";
import type { TlCorpOrganization } from "@/lib/tl-corp-organization-shared";

export default function PublicEstimatePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<{
    organization: TlCorpOrganization;
    project: { id: string; name: string; address: string | null };
    client_display?: {
      clientName: string;
      billingAddress: string | null;
      serviceAddress: string | null;
    };
    delivery: {
      sent_at: string;
      sent_to_email: string;
      snapshot_total: number;
      snapshot_line_items: EstimateLineItem[];
      snapshot_settings: EstimateSettingsInput;
      recipient_name?: string;
      hide_line_item_prices_for_client?: boolean;
      hide_markup_for_client?: boolean;
    };
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/estimate/public/${token}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Estimate not available");
          return;
        }
        setData(json);
        await fetch(`/api/estimate/public/${token}`, { method: "POST" });
      } catch {
        setError("Failed to load estimate");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg)">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--tl-navy) border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg) px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-(--text)">Estimate Not Available</h1>
          <p className="mt-2 text-sm text-(--text)/70">{error || "This link may have expired."}</p>
          <Link href="/" className="mt-6 inline-block text-sm text-(--tl-royal) hover:underline">
            Go to Taylor Leonard CRM
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg) py-8 px-4 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text)/50">
            {data.organization.business_name}
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-(--tl-royal) hover:underline"
          >
            Sign in to your account →
          </Link>
        </div>

        <EstimateViewer
          projectName={data.project.name}
          projectAddress={data.project.address}
          clientName={
            data.client_display?.clientName ||
            data.delivery.recipient_name ||
            data.delivery.sent_to_email
          }
          clientEmail={data.delivery.sent_to_email}
          billingAddress={data.client_display?.billingAddress}
          serviceAddress={data.client_display?.serviceAddress}
          lineItems={data.delivery.snapshot_line_items}
          settings={data.delivery.snapshot_settings || DEFAULT_ESTIMATE_SETTINGS}
          grandTotal={data.delivery.snapshot_total}
          organization={data.organization}
          hideLineItemPricing={Boolean(data.delivery.hide_line_item_prices_for_client)}
          hideMarkup={Boolean(data.delivery.hide_markup_for_client)}
          sentAt={data.delivery.sent_at}
        />
      </div>
    </div>
  );
}
