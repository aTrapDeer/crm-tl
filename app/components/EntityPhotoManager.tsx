"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { formatUsCentralDateTime } from "@/lib/us-central-time";
import { ModalLayer } from "@/app/components/ModalLayer";

type EntityPhotoType = "work_order" | "incident_report";
type EntityPhotoRole = "before" | "after" | "general";

interface EntityPhoto {
  id: string;
  entity_type: EntityPhotoType;
  entity_id: string;
  photo_role: EntityPhotoRole;
  filename: string;
  s3_url: string | null;
  caption: string | null;
  captured_at: string;
  uploader_name?: string;
  created_at: string;
}

interface EntityPhotoManagerProps {
  endpoint: string;
  title: string;
  description?: string;
  canManage: boolean;
  lockedMessage?: string;
  /** Override default labels (e.g. map `general` to "Material"). */
  roleLabels?: Partial<Record<EntityPhotoRole, string>>;
  /** If set, only these roles are shown and offered in the upload form (default: all). */
  allowedRoles?: EntityPhotoRole[];
}

const PHOTO_ROLE_LABELS: Record<EntityPhotoRole, string> = {
  before: "Before",
  after: "After",
  general: "General",
};

function groupPhotos(photos: EntityPhoto[]): Record<EntityPhotoRole, EntityPhoto[]> {
  return {
    before: photos.filter((photo) => photo.photo_role === "before"),
    after: photos.filter((photo) => photo.photo_role === "after"),
    general: photos.filter((photo) => photo.photo_role === "general"),
  };
}

const ALL_ROLES: EntityPhotoRole[] = ["before", "after", "general"];

export default function EntityPhotoManager({
  endpoint,
  title,
  description,
  canManage,
  lockedMessage,
  roleLabels,
  allowedRoles,
}: EntityPhotoManagerProps) {
  const [photos, setPhotos] = useState<EntityPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [viewerPhoto, setViewerPhoto] = useState<EntityPhoto | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const roleOrder = (allowedRoles?.length ? ALL_ROLES.filter((r) => allowedRoles.includes(r)) : ALL_ROLES) as EntityPhotoRole[];
  const [uploadForm, setUploadForm] = useState({
    photo_role: "before" as EntityPhotoRole,
    caption: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const photoFileInputId = useId();

  const labels = { ...PHOTO_ROLE_LABELS, ...roleLabels };

  function clearPhotoFile() {
    setSelectedFile(null);
    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    async function loadPhotos() {
      setLoading(true);
      try {
        const res = await fetch(endpoint);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to load photos.");
          return;
        }
        setPhotos(data.photos || []);
      } catch (fetchError) {
        console.error("Failed to fetch entity photos:", fetchError);
        setError("Failed to load photos.");
      } finally {
        setLoading(false);
      }
    }

    void loadPhotos();
  }, [endpoint]);

  async function refreshPhotos() {
    try {
      const res = await fetch(endpoint);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load photos.");
        return;
      }
      setPhotos(data.photos || []);
    } catch (fetchError) {
      console.error("Failed to refresh entity photos:", fetchError);
      setError("Failed to load photos.");
    }
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a photo to upload.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append(
        "photo_role",
        roleOrder.length === 1 ? roleOrder[0]! : uploadForm.photo_role
      );
      formData.append("caption", uploadForm.caption);

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to upload photo.");
        return;
      }

      setShowUploadModal(false);
      clearPhotoFile();
      setUploadForm({ photo_role: roleOrder[0] ?? "before", caption: "" });
      await refreshPhotos();
    } catch (uploadError) {
      console.error("Failed to upload entity photo:", uploadError);
      setError("Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: string) {
    if (!canManage) return;
    if (!window.confirm("Delete this photo?")) return;

    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to delete photo.");
        return;
      }

      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      if (viewerPhoto?.id === photoId) {
        setViewerPhoto(null);
      }
    } catch (deleteError) {
      console.error("Failed to delete entity photo:", deleteError);
      setError("Failed to delete photo.");
    }
  }

  const visiblePhotos = allowedRoles?.length
    ? photos.filter((p) => allowedRoles.includes(p.photo_role))
    : photos;
  const groupedPhotos = groupPhotos(visiblePhotos);

  return (
    <section className="tl-card p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-(--text)">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-(--text)/60">{description}</p>
          )}
          {!canManage && lockedMessage && (
            <p className="mt-2 text-xs text-(--text)/50">{lockedMessage}</p>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              clearPhotoFile();
              setUploadForm({ photo_role: roleOrder[0] ?? "before", caption: "" });
              setShowUploadModal(true);
            }}
            className="tl-btn px-4 py-2 text-sm"
          >
            + Add Photo
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
      ) : visiblePhotos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-(--border)/40 px-4 py-10 text-center">
          <p className="text-sm text-(--text)/60">No photos uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {roleOrder.filter((role) => groupedPhotos[role].length > 0).map((role) => (
            <div key={role} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-(--text)">
                  {labels[role]} Photos ({groupedPhotos[role].length})
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {groupedPhotos[role].map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setViewerPhoto(photo)}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-(--bg) text-left"
                  >
                    {photo.s3_url ? (
                      <Image
                        src={photo.s3_url}
                        alt={photo.caption || photo.filename}
                        fill
                        unoptimized
                        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-(--text)/50">
                        No preview
                      </div>
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
                      <span>{labels[photo.photo_role]}</span>
                      <span>{formatUsCentralDateTime(photo.captured_at)} CT</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] text-white">
                      <p className="truncate font-medium">
                        {photo.caption || photo.filename}
                      </p>
                    </div>
                    <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <ModalLayer
          align="center"
          className="bg-black/50"
          onBackdropClick={() => {
            setShowUploadModal(false);
            clearPhotoFile();
          }}
        >
          <div
            className="tl-card w-full max-w-md p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text)">Upload Photo</h3>
            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              {roleOrder.length > 1 ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-(--text)">Photo type</label>
                  <select
                    value={uploadForm.photo_role}
                    onChange={(event) =>
                      setUploadForm((current) => ({
                        ...current,
                        photo_role: event.target.value as EntityPhotoRole,
                      }))
                    }
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text)"
                  >
                    {roleOrder.map((role) => (
                      <option key={role} value={role}>
                        {labels[role]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-(--text)/75">
                  Adding a <span className="font-semibold text-(--text)">{labels[roleOrder[0] ?? "before"]}</span> photo.
                </p>
              )}

              <div>
                <span className="mb-1 block text-sm font-medium text-(--text)">Photo file</span>
                <p className="mb-2 text-xs text-(--text)/55">
                  Required — image from your device (JPG, PNG, or other common formats).
                </p>
                <input
                  ref={photoFileInputRef}
                  id={photoFileInputId}
                  type="file"
                  accept="image/*"
                  required
                  className="sr-only"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
                <label
                  htmlFor={photoFileInputId}
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
                {selectedFile ? (
                  <p className="mt-2 text-sm text-(--text)/80">
                    <span className="font-medium text-emerald-700">Selected:</span> {selectedFile.name}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-800/90">No file chosen yet — tap the area above.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-(--text)">
                  Caption
                </label>
                <input
                  type="text"
                  value={uploadForm.caption}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      caption: event.target.value,
                    }))
                  }
                  placeholder="Optional note about the photo"
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-2.5 text-sm text-(--text)"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    clearPhotoFile();
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
                  {uploading ? "Uploading..." : "Upload Photo"}
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}

      {viewerPhoto && (
        <ModalLayer align="center" className="bg-black/70" onBackdropClick={() => setViewerPhoto(null)}>
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-(--border)/20 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-(--text)">
                  {viewerPhoto.caption || viewerPhoto.filename}
                </p>
                <p className="text-xs text-(--text)/60">
                  {labels[viewerPhoto.photo_role]} photo captured{" "}
                  {formatUsCentralDateTime(viewerPhoto.captured_at)} CT
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(viewerPhoto.id)}
                    className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerPhoto(null)}
                  className="rounded-full border border-(--border)/30 px-3 py-1.5 text-xs font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-100">
              {viewerPhoto.s3_url ? (
                <Image
                  src={viewerPhoto.s3_url}
                  alt={viewerPhoto.caption || viewerPhoto.filename}
                  width={1600}
                  height={1200}
                  unoptimized
                  className="mx-auto max-h-[70vh] w-auto"
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-(--text)/50">
                  No preview available
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border)/20 px-4 py-3 text-xs text-(--text)/60">
              <div className="space-y-1">
                <p>{viewerPhoto.filename}</p>
                {viewerPhoto.uploader_name && (
                  <p>Uploaded by {viewerPhoto.uploader_name}</p>
                )}
              </div>
              <p>{new Date(viewerPhoto.created_at).toLocaleString()}</p>
            </div>
          </div>
        </ModalLayer>
      )}
    </section>
  );
}
