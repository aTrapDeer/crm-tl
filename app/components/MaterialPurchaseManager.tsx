"use client";

import { useCallback, useEffect, useState } from "react";
import { ModalLayer } from "@/app/components/ModalLayer";
import { formatUsCentralDateTime } from "@/lib/us-central-time";

interface MaterialPurchase {
  id: string;
  store_name: string;
  description: string | null;
  total_cost: number;
  receipt_filename: string;
  receipt_s3_url: string | null;
  purchaser_name?: string;
  created_at: string;
}

interface MaterialPurchaseManagerProps {
  endpoint: string;
  title?: string;
  description?: string;
  canManage: boolean;
  lockedMessage?: string;
  onTotalChange?: (total: number) => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function MaterialPurchaseManager({
  endpoint,
  title = "Materials Purchases",
  description,
  canManage,
  lockedMessage,
  onTotalChange,
}: MaterialPurchaseManagerProps) {
  const [purchases, setPurchases] = useState<MaterialPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewerPurchase, setViewerPurchase] = useState<MaterialPurchase | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    store_name: "",
    description: "",
    total_cost: "",
  });

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load material purchases.");
        return;
      }
      setPurchases(data.purchases || []);
    } catch (fetchError) {
      console.error("Failed to fetch material purchases:", fetchError);
      setError("Failed to load material purchases.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  const total = purchases.reduce((sum, purchase) => sum + (purchase.total_cost || 0), 0);

  useEffect(() => {
    onTotalChange?.(total);
  }, [onTotalChange, total]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a receipt photo to upload.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("store_name", form.store_name);
      formData.append("description", form.description);
      formData.append("total_cost", form.total_cost);
      formData.append("file", selectedFile);

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save material purchase.");
        return;
      }

      setForm({ store_name: "", description: "", total_cost: "" });
      setSelectedFile(null);
      setShowAddModal(false);
      await loadPurchases();
    } catch (uploadError) {
      console.error("Failed to save material purchase:", uploadError);
      setError("Failed to save material purchase.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(purchaseId: string) {
    if (!canManage) return;
    if (!window.confirm("Delete this material purchase entry?")) return;

    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to delete material purchase.");
        return;
      }

      setPurchases((current) => current.filter((purchase) => purchase.id !== purchaseId));
      if (viewerPurchase?.id === purchaseId) {
        setViewerPurchase(null);
      }
    } catch (deleteError) {
      console.error("Failed to delete material purchase:", deleteError);
      setError("Failed to delete material purchase.");
    }
  }

  return (
    <section className="tl-card p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-(--text)">{title}</h2>
          {description && <p className="mt-1 text-sm text-(--text)/60">{description}</p>}
          {!canManage && lockedMessage && <p className="mt-2 text-xs text-(--text)/50">{lockedMessage}</p>}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="tl-btn px-4 py-2 text-sm"
          >
            + Add Store Receipt
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-(--border)/40 px-4 py-10 text-center">
          <p className="text-sm text-(--text)/60">No store receipts recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <div
              key={purchase.id}
              className="rounded-2xl border border-(--border)/20 bg-(--bg)/40 p-3 sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setViewerPurchase(purchase)}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                    title="Open receipt photo"
                  >
                    {purchase.receipt_s3_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={purchase.receipt_s3_url}
                        alt={purchase.receipt_filename}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[11px] text-(--text)/45">
                        Receipt
                      </span>
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--text)">{purchase.store_name}</p>
                    {purchase.description && (
                      <p className="mt-1 text-sm text-(--text)/70 whitespace-pre-wrap">{purchase.description}</p>
                    )}
                    <p className="mt-2 text-xs text-(--text)/55">
                      Receipt uploaded {formatUsCentralDateTime(purchase.created_at)} CT
                      {purchase.purchaser_name ? ` by ${purchase.purchaser_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-(--text)/45">{purchase.receipt_filename}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <p className="text-base font-semibold text-(--text)">{formatCurrency(purchase.total_cost)}</p>
                  <div className="mt-0 sm:mt-3">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(purchase.id)}
                        className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setViewerPurchase(purchase)}
                        className="rounded-full border border-(--border)/30 px-3 py-1.5 text-xs font-medium text-(--text) hover:bg-(--bg) transition"
                      >
                        View Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end border-t border-(--border)/20 pt-3">
        <p className="text-sm font-semibold text-(--text)">Receipt Materials Total: {formatCurrency(total)}</p>
      </div>

      {showAddModal && (
        <ModalLayer
          align="center"
          className="bg-black/50"
          onBackdropClick={() => {
            if (uploading) return;
            setShowAddModal(false);
            setSelectedFile(null);
          }}
        >
          <div className="tl-card w-full max-w-lg p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text)">Add Store Receipt</h3>
            <p className="mt-1 text-sm text-(--text)/60">
              Save the store, optional notes, receipt photo, and total cost for this purchase.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-(--text)">Store</label>
                <input
                  type="text"
                  required
                  value={form.store_name}
                  onChange={(event) => setForm((current) => ({ ...current, store_name: event.target.value }))}
                  placeholder="Home Depot, Lowe's, Grainger, etc."
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-(--text)">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Optional note about what was purchased"
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text)"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--text)">Receipt Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text)"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-(--text)">Total Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.total_cost}
                    onChange={(event) => setForm((current) => ({ ...current, total_cost: event.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text)"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {uploading ? "Saving..." : "Save Receipt"}
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {viewerPurchase && (
        <ModalLayer align="center" className="bg-black/70" onBackdropClick={() => setViewerPurchase(null)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-(--border)/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-(--text)">{viewerPurchase.store_name}</p>
                <p className="text-xs text-(--text)/60">
                  {formatCurrency(viewerPurchase.total_cost)} recorded {formatUsCentralDateTime(viewerPurchase.created_at)} CT
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewerPurchase(null)}
                className="rounded-full border border-(--border)/30 px-3 py-1.5 text-xs font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-100">
              {viewerPurchase.receipt_s3_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewerPurchase.receipt_s3_url}
                  alt={viewerPurchase.receipt_filename}
                  className="mx-auto max-h-[70vh] w-auto"
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-(--text)/50">
                  No preview available
                </div>
              )}
            </div>
            <div className="space-y-1 border-t border-(--border)/20 px-4 py-3 text-xs text-(--text)/60">
              <p>{viewerPurchase.receipt_filename}</p>
              {viewerPurchase.description && <p>{viewerPurchase.description}</p>}
              {viewerPurchase.purchaser_name && <p>Uploaded by {viewerPurchase.purchaser_name}</p>}
            </div>
          </div>
        </ModalLayer>
      )}
    </section>
  );
}
