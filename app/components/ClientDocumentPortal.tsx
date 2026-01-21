"use client";

import { useState, useEffect, useCallback } from "react";

interface Document {
  id: string;
  filename: string;
  display_name: string;
  description: string | null;
  file_type: string | null;
  file_size: number | null;
  s3_url: string | null;
  work_order_number?: string;
  project_name?: string;
  uploader_name?: string;
  created_at: string;
}

interface ClientDocument {
  id: string;
  document_id: string;
  document: Document;
  shared_by: string | null;
  sharer_name?: string;
  can_download: boolean;
  viewed_at: string | null;
  downloaded_at: string | null;
  created_at: string;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: "📄",
  doc: "📝",
  xls: "📊",
  image: "🖼️",
  text: "📃",
  other: "📎",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientDocumentPortal() {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.shares || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleDownload(doc: ClientDocument) {
    if (!doc.can_download || !doc.document.s3_url) return;

    try {
      // Call download endpoint to track the download
      await fetch(`/api/documents/${doc.document_id}/download`);

      // Open the document URL
      window.open(doc.document.s3_url, "_blank");

      // Update local state
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? { ...d, downloaded_at: new Date().toISOString() }
            : d
        )
      );
    } catch (error) {
      console.error("Failed to download document:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-(--text)"></div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-(--text)/30 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="text-(--text)/60 text-sm">No documents shared with you yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="tl-card p-4 flex items-start gap-4"
        >
          <div className="text-3xl shrink-0">
            {FILE_TYPE_ICONS[doc.document.file_type || "other"]}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-(--text)">{doc.document.display_name}</h4>
            {doc.document.description && (
              <p className="text-sm text-(--text)/70 mt-1">{doc.document.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-(--text)/50">
              <span>{formatFileSize(doc.document.file_size)}</span>
              <span>Shared {new Date(doc.created_at).toLocaleDateString()}</span>
              {doc.sharer_name && <span>by {doc.sharer_name}</span>}
              {doc.document.work_order_number && (
                <span>WO: {doc.document.work_order_number}</span>
              )}
              {doc.document.project_name && (
                <span>Project: {doc.document.project_name}</span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {doc.can_download && doc.document.s3_url ? (
              <button
                onClick={() => handleDownload(doc)}
                className="tl-btn-outline px-3 py-2 text-xs"
              >
                <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            ) : (
              <span className="text-xs text-(--text)/50">View only</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
