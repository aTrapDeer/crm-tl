"use client";

import { useCallback, useEffect, useRef, useId, useState } from "react";
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

interface MaterialPhoto {
  id: string;
  photo_role: string;
  s3_url: string | null;
  caption: string | null;
  filename: string;
  captured_at: string;
  uploader_name?: string;
}

interface MaterialPurchaseManagerProps {
  endpoint: string;
  title?: string;
  description?: string;
  canManage: boolean;
  lockedMessage?: string;
  onTotalChange?: (total: number) => void;
  /** When set, shows material/supply photos (stored as photo role `general`) in this section. */
  materialPhotosEndpoint?: string;
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
  materialPhotosEndpoint,
}: MaterialPurchaseManagerProps) {
  const [purchases, setPurchases] = useState<MaterialPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewerPurchase, setViewerPurchase] = useState<MaterialPurchase | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [materialPhotos, setMaterialPhotos] = useState<MaterialPhoto[]>([]);
  const [loadingMaterialPhotos, setLoadingMaterialPhotos] = useState(false);
  const [materialPhotoError, setMaterialPhotoError] = useState("");
  const [showMaterialPhotoModal, setShowMaterialPhotoModal] = useState(false);
  const [materialPhotoFile, setMaterialPhotoFile] = useState<File | null>(null);
  const [materialPhotoCaption, setMaterialPhotoCaption] = useState("");
  const [uploadingMaterialPhoto, setUploadingMaterialPhoto] = useState(false);
  const [viewerMaterialPhoto, setViewerMaterialPhoto] = useState<MaterialPhoto | null>(null);
  const materialPhotoInputRef = useRef<HTMLInputElement>(null);
  const materialPhotoInputId = useId();
  const [form, setForm] = useState({
    store_name: "",
    description: "",
    total_cost: "",
  });
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const receiptFileInputId = useId();

  function clearReceiptFile() {
    setSelectedFile(null);
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = "";
    }
  }

  function clearMaterialPhotoFile() {
    setMaterialPhotoFile(null);
    if (materialPhotoInputRef.current) {
      materialPhotoInputRef.current.value = "";
    }
  }

  const loadMaterialPhotos = useCallback(async () => {
    if (!materialPhotosEndpoint) return;
    setLoadingMaterialPhotos(true);
    setMaterialPhotoError("");
    try {
      const res = await fetch(materialPhotosEndpoint);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMaterialPhotoError(data.error || "Failed to load material photos.");
        return;
      }
      const list = (data.photos || []) as MaterialPhoto[];
      setMaterialPhotos(list.filter((p) => p.photo_role === "general"));
    } catch (fetchError) {
      console.error("Failed to fetch material photos:", fetchError);
      setMaterialPhotoError("Failed to load material photos.");
    } finally {
      setLoadingMaterialPhotos(false);
    }
  }, [materialPhotosEndpoint]);

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

  useEffect(() => {
    void loadMaterialPhotos();
  }, [loadMaterialPhotos]);

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
      clearReceiptFile();
      setShowAddModal(false);
      await loadPurchases();
    } catch (uploadError) {
      console.error("Failed to save material purchase:", uploadError);
      setError("Failed to save material purchase.");
    } finally {
      setUploading(false);
    }
  }

  async function handleMaterialPhotoSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!materialPhotosEndpoint || !materialPhotoFile) {
      setMaterialPhotoError("Choose a photo to upload.");
      return;
    }

    setUploadingMaterialPhoto(true);
    setMaterialPhotoError("");
    try {
      const formData = new FormData();
      formData.append("file", materialPhotoFile);
      formData.append("photo_role", "general");
      formData.append("caption", materialPhotoCaption);

      const res = await fetch(materialPhotosEndpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMaterialPhotoError(data.error || "Failed to upload material photo.");
        return;
      }

      setShowMaterialPhotoModal(false);
      setMaterialPhotoCaption("");
      clearMaterialPhotoFile();
      await loadMaterialPhotos();
    } catch (uploadError) {
      console.error("Failed to upload material photo:", uploadError);
      setMaterialPhotoError("Failed to upload material photo.");
    } finally {
      setUploadingMaterialPhoto(false);
    }
  }

  async function handleDeleteMaterialPhoto(photoId: string) {
    if (!canManage || !materialPhotosEndpoint) return;
    if (!window.confirm("Delete this material photo?")) return;

    setMaterialPhotoError("");
    try {
      const res = await fetch(materialPhotosEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMaterialPhotoError(data.error || "Failed to delete photo.");
        return;
      }

      setMaterialPhotos((current) => current.filter((p) => p.id !== photoId));
      if (viewerMaterialPhoto?.id === photoId) {
        setViewerMaterialPhoto(null);
      }
    } catch (deleteError) {
      console.error("Failed to delete material photo:", deleteError);
      setMaterialPhotoError("Failed to delete material photo.");
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
          <div className="flex flex-wrap gap-2">
            {materialPhotosEndpoint && (
              <button
                type="button"
                onClick={() => {
                  clearMaterialPhotoFile();
                  setMaterialPhotoCaption("");
                  setMaterialPhotoError("");
                  setShowMaterialPhotoModal(true);
                }}
                className="rounded-full border border-(--border)/40 bg-(--bg) px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg)/80 transition"
              >
                + Add material photo
              </button>
            )}
            <button type="button" onClick={() => setShowAddModal(true)} className="tl-btn px-4 py-2 text-sm">
              + Add store receipt
            </button>
          </div>
        )}
      </div>

      {materialPhotosEndpoint && (
        <div className="rounded-2xl border border-(--border)/20 bg-(--bg)/30 p-4 md:p-5 space-y-3">
          <h3 className="text-base font-semibold text-(--text)">Material photos</h3>
          <p className="text-sm text-(--text)/60">
            Parts, supplies, labels, or packaging. For the register receipt with the total, use <strong className="font-medium text-(--text)">Add store receipt</strong>.
          </p>
          {materialPhotoError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {materialPhotoError}
            </div>
          )}
          {loadingMaterialPhotos ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)" />
            </div>
          ) : materialPhotos.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-(--border)/35 px-4 py-8 text-center">
              <p className="text-sm text-(--text)/60">No material photos yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {materialPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setViewerMaterialPhoto(photo)}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 text-left"
                >
                  {photo.s3_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.s3_url}
                      alt={photo.caption || photo.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-(--text)/50">No preview</span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] text-white truncate">
                    {photo.caption || photo.filename}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            clearReceiptFile();
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

              <div className="space-y-4">
                <div>
                  <span className="mb-1 block text-sm font-medium text-(--text)">Receipt photo</span>
                  <p className="mb-2 text-xs text-(--text)/55">
                    Required — upload a photo of the paper or digital receipt (JPG, PNG, or other images).
                  </p>
                  <input
                    ref={receiptFileInputRef}
                    id={receiptFileInputId}
                    type="file"
                    accept="image/*"
                    required
                    className="sr-only"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor={receiptFileInputId}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--border) bg-(--bg) px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700" aria-hidden>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-semibold text-(--text)">Choose receipt image</span>
                    <span className="text-xs text-(--text)/55">Opens your camera or photo library on mobile</span>
                  </label>
                  {selectedFile ? (
                    <p className="mt-2 text-sm text-(--text)/80">
                      <span className="font-medium text-emerald-700">Selected:</span> {selectedFile.name}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-800/90">No file chosen yet — tap the area above.</p>
                  )}
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
                    clearReceiptFile();
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

      {showMaterialPhotoModal && materialPhotosEndpoint && (
        <ModalLayer
          align="center"
          className="bg-black/50"
          onBackdropClick={() => {
            if (uploadingMaterialPhoto) return;
            setShowMaterialPhotoModal(false);
            clearMaterialPhotoFile();
            setMaterialPhotoCaption("");
          }}
        >
          <div className="tl-card w-full max-w-md p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text)">Add material photo</h3>
            <p className="mt-1 text-sm text-(--text)/60">Supply, parts, or jobsite documentation (not the store receipt).</p>
            <form onSubmit={handleMaterialPhotoSubmit} className="mt-4 space-y-4">
              <div>
                <span className="mb-1 block text-sm font-medium text-(--text)">Photo file</span>
                <p className="mb-2 text-xs text-(--text)/55">Required — JPG, PNG, or other image.</p>
                <input
                  ref={materialPhotoInputRef}
                  id={materialPhotoInputId}
                  type="file"
                  accept="image/*"
                  required
                  className="sr-only"
                  onChange={(event) => setMaterialPhotoFile(event.target.files?.[0] || null)}
                />
                <label
                  htmlFor={materialPhotoInputId}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-(--border) bg-(--bg) px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700" aria-hidden>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-(--text)">Choose photo to upload</span>
                  <span className="text-xs text-(--text)/55">Opens your camera or photo library on mobile</span>
                </label>
                {materialPhotoFile ? (
                  <p className="mt-2 text-sm text-(--text)/80">
                    <span className="font-medium text-emerald-700">Selected:</span> {materialPhotoFile.name}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-800/90">No file chosen yet — tap the area above.</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-(--text)">Caption</label>
                <input
                  type="text"
                  value={materialPhotoCaption}
                  onChange={(event) => setMaterialPhotoCaption(event.target.value)}
                  placeholder="Optional (e.g. copper fittings, aisle 12)"
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialPhotoModal(false);
                    clearMaterialPhotoFile();
                    setMaterialPhotoCaption("");
                  }}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingMaterialPhoto}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {uploadingMaterialPhoto ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {viewerMaterialPhoto && (
        <ModalLayer align="center" className="bg-black/70" onBackdropClick={() => setViewerMaterialPhoto(null)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-(--border)/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-(--text)">
                  {viewerMaterialPhoto.caption || viewerMaterialPhoto.filename}
                </p>
                <p className="text-xs text-(--text)/60">
                  Material photo · {formatUsCentralDateTime(viewerMaterialPhoto.captured_at)} CT
                  {viewerMaterialPhoto.uploader_name ? ` · ${viewerMaterialPhoto.uploader_name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteMaterialPhoto(viewerMaterialPhoto.id)}
                    className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerMaterialPhoto(null)}
                  className="rounded-full border border-(--border)/30 px-3 py-1.5 text-xs font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-100">
              {viewerMaterialPhoto.s3_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewerMaterialPhoto.s3_url}
                  alt={viewerMaterialPhoto.caption || viewerMaterialPhoto.filename}
                  className="mx-auto max-h-[70vh] w-auto"
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-(--text)/50">No preview</div>
              )}
            </div>
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
