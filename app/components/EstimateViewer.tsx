"use client";

import Image from "next/image";
import {
  calculateEstimateBreakdown,
  calculateInstallmentAmounts,
  formatCurrency,
  getCategoryLabel,
} from "@/lib/estimate";
import { DISCLOSURE_SECTIONS } from "@/lib/estimate-terms";
import {
  formatTlCorpPhone,
  type TlCorpOrganization,
} from "@/lib/tl-corp-organization-shared";
import type { EstimateLineItem } from "@/lib/projects";
import type { EstimateSettingsInput } from "@/lib/estimate";

interface EstimateViewerProps {
  projectName: string;
  projectAddress: string | null;
  clientName: string;
  clientEmail?: string;
  billingAddress?: string | null;
  serviceAddress?: string | null;
  lineItems: EstimateLineItem[];
  settings: EstimateSettingsInput;
  grandTotal: number;
  organization: TlCorpOrganization;
  hideLineItemPricing?: boolean;
  hideMarkup?: boolean;
  sentAt?: string | null;
}

export default function EstimateViewer({
  projectName,
  projectAddress,
  clientName,
  clientEmail,
  billingAddress,
  serviceAddress,
  lineItems,
  settings,
  grandTotal,
  organization,
  hideLineItemPricing = false,
  hideMarkup = false,
  sentAt,
}: EstimateViewerProps) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const breakdown = calculateEstimateBreakdown(subtotal, settings);
  const displayTotal = grandTotal || breakdown.total;
  const installments = calculateInstallmentAmounts(displayTotal, settings.installment_schedule);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header with branding */}
      <div className="tl-card overflow-hidden">
        <div className="bg-linear-to-r from-(--tl-navy) to-(--tl-royal) px-6 py-8 text-white">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Image
                  src="/NoTextLogoFIXED.png"
                  alt="Taylor Leonard"
                  width={40}
                  height={40}
                  className="object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div>
                <p className="text-lg font-bold tracking-wide">{organization.business_name}</p>
                {organization.registration_label && (
                  <p className="mt-1 text-sm text-white/80">{organization.registration_label}</p>
                )}
                <p className="text-sm text-white/80">{formatTlCorpPhone(organization.phone)}</p>
                <p className="text-sm text-white/80">{organization.email}</p>
                <p className="text-sm text-white/80">{organization.address_line1}</p>
                <p className="text-sm text-white/80">{organization.city_state}</p>
                <p className="text-sm text-white/80">{organization.postal_code}</p>
                {organization.website && (
                  <p className="text-sm text-white/80">{organization.website}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Project Estimate</p>
              <p className="mt-1 text-xl font-semibold">{projectName}</p>
              {sentAt && (
                <p className="mt-2 text-sm text-white/70">
                  Sent {new Date(sentAt).toLocaleDateString("en-US")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Total + Installments — above the fold */}
        <div className="border-b border-(--border) px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-(--tl-navy) px-6 py-6 text-white">
              <p className="text-sm uppercase tracking-[0.15em] text-white/70">Total Estimate</p>
              <p className="mt-2 text-4xl font-bold">{formatCurrency(displayTotal)}</p>
              {!hideMarkup && breakdown.markup > 0 && (
                <p className="mt-2 text-sm text-white/70">
                  Includes markup, tax, and fees as applicable
                </p>
              )}
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-(--text)">
                Payment Schedule
              </p>
              <div className="space-y-2">
                {installments.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-(--border) bg-(--bg) px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-(--text)">{item.label}</p>
                      <p className="text-xs text-(--text)/70">{item.due_description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-(--tl-navy)">{formatCurrency(item.amount)}</p>
                      <p className="text-xs text-(--text)/60">{item.percent}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="grid gap-3 border-b border-(--border) px-6 py-6 sm:grid-cols-2">
          <div className="rounded-xl bg-(--bg) p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-(--text)/60">TL Corp</p>
            <p className="mt-1 text-sm font-medium text-(--text)">{organization.business_name}</p>
            <p className="text-sm text-(--text)/70">{organization.address_line1}</p>
            <p className="text-sm text-(--text)/70">
              {[organization.city_state, organization.postal_code].filter(Boolean).join(" ")}
            </p>
          </div>
          <div className="rounded-xl bg-(--bg) p-4">
            <p className="text-xs uppercase tracking-wider text-(--text)/60">Bill To</p>
            <p className="mt-1 text-sm font-medium text-(--text)">{clientName}</p>
            {clientEmail && <p className="text-sm text-(--text)/70">{clientEmail}</p>}
          </div>
          <div className="rounded-xl bg-(--bg) p-4">
            <p className="text-xs uppercase tracking-wider text-(--text)/60">Billing Address</p>
            <p className="mt-1 text-sm font-medium text-(--text)">
              {billingAddress || "—"}
            </p>
          </div>
          <div className="rounded-xl bg-(--bg) p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-(--text)/60">Service Address</p>
            <p className="mt-1 text-sm font-medium text-(--text)">
              {serviceAddress || projectAddress || "No service address provided"}
            </p>
          </div>
        </div>

        {/* Line items table */}
        <div className="px-6 py-6">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-(--text)">
            Scope & Line Items
          </p>
          {lineItems.length === 0 ? (
            <p className="text-sm text-(--text)/70">No line items in this estimate.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--border) text-left text-xs uppercase tracking-wider text-(--text)/60">
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4">Description</th>
                    <th className="pb-3 pr-4 text-right">Qty</th>
                    {!hideLineItemPricing && (
                      <>
                        <th className="pb-3 pr-4 text-right">Rate</th>
                        <th className="pb-3 text-right">Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className="border-b border-(--border)/50">
                      <td className="py-3 pr-4 font-medium text-(--tl-navy)">
                        {getCategoryLabel(item)}
                      </td>
                      <td className="py-3 pr-4 text-(--text)">
                        <p>{item.description || "-"}</p>
                        {item.photos && item.photos.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.photos
                              .filter((photo) => photo.s3_url)
                              .map((photo) => (
                                <a
                                  key={photo.id}
                                  href={photo.s3_url || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-16 w-20 overflow-hidden rounded-md border border-(--border) bg-(--bg)"
                                >
                                  <img
                                    src={photo.s3_url || ""}
                                    alt={photo.caption || photo.filename}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-(--text)">{item.quantity}</td>
                      {!hideLineItemPricing && (
                        <>
                          <td className="py-3 pr-4 text-right text-(--text)">
                            {formatCurrency(item.price_rate)}
                          </td>
                          <td className="py-3 text-right font-semibold text-(--tl-navy)">
                            {formatCurrency(item.total)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!hideLineItemPricing && (
            <div className="mt-4 space-y-2 border-t border-(--border) pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-(--text)/70">Subtotal</span>
                <span className="font-medium text-(--text)">{formatCurrency(subtotal)}</span>
              </div>
              {!hideMarkup && breakdown.markup > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-(--text)/70">Markup</span>
                  <span className="text-(--text)">{formatCurrency(breakdown.markup)}</span>
                </div>
              )}
              {!hideMarkup && breakdown.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-(--text)/70">Tax</span>
                  <span className="text-(--text)">{formatCurrency(breakdown.tax)}</span>
                </div>
              )}
              {!hideMarkup && breakdown.servicingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-(--text)/70">Online Servicing Fee (3.5%)</span>
                  <span className="text-(--text)">{formatCurrency(breakdown.servicingFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-(--border) pt-2">
                <span className="font-semibold text-(--text)">Grand Total</span>
                <span className="text-lg font-bold text-(--tl-navy)">{formatCurrency(displayTotal)}</span>
              </div>
            </div>
          )}
          {hideLineItemPricing && (
            <p className="mt-4 border-t border-(--border) pt-4 text-sm text-(--text)/60">
              Per-line pricing is not shown. Your total estimate and payment schedule are above.
            </p>
          )}
        </div>
      </div>

      {/* Terms & details below the fold */}
      <div className="tl-card p-6">
        <h2 className="mb-6 text-lg font-semibold text-(--tl-navy)">
          Terms, Conditions & Details
        </h2>
        {settings.custom_terms ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-(--text)">
            {settings.custom_terms}
          </div>
        ) : (
          <div className="space-y-6">
            {DISCLOSURE_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-(--tl-navy)">
                  {section.title}
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-(--text)/80">
                  {section.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {organization.invoice_footer.trim() && (
        <div className="tl-card p-6">
          <h2 className="mb-3 text-lg font-semibold text-(--tl-navy)">Invoice Footer</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-(--text)/80">
            {organization.invoice_footer}
          </p>
        </div>
      )}
    </div>
  );
}
