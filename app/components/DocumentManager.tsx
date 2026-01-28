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
  work_order_id: string | null;
  work_order_number?: string;
  project_id: string | null;
  project_name?: string;
  uploader_name?: string;
  is_public: boolean;
  created_at: string;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface DocumentShare {
  id: string;
  document_id: string;
  client_user_id: string;
  client_name?: string;
  client_email?: string;
  shared_by: string | null;
  sharer_name?: string;
  can_download: boolean;
  viewed_at: string | null;
  downloaded_at: string | null;
  created_at: string;
}

interface DocumentManagerProps {
  userRole: "admin" | "employee";
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

export default function DocumentManager({ userRole }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState<Document | null>(null);
  const [documentShares, setDocumentShares] = useState<DocumentShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);

  // Form states
  const [uploadForm, setUploadForm] = useState({
    display_name: "",
    description: "",
    file_type: "",
    s3_url: "",
    is_public: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [shareForm, setShareForm] = useState({
    client_user_id: "",
    can_download: true,
  });

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/documents/clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchClients();
  }, [fetchDocuments, fetchClients]);

  async function fetchDocumentShares(documentId: string) {
    setLoadingShares(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/share`);
      const data = await res.json();
      setDocumentShares(data.shares || []);
    } catch (error) {
      console.error("Failed to fetch document shares:", error);
    } finally {
      setLoadingShares(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.display_name.trim()) return;

    setUploading(true);
    try {
      // For now, we just create a document record with the URL
      // In production, you would upload to S3 first
      const filename = selectedFile?.name || `document-${Date.now()}`;

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          display_name: uploadForm.display_name,
          description: uploadForm.description || null,
          file_type: uploadForm.file_type || null,
          file_size: selectedFile?.size || null,
          s3_url: uploadForm.s3_url || null,
          is_public: uploadForm.is_public,
        }),
      });

      if (res.ok) {
        setShowUploadModal(false);
        setUploadForm({ display_name: "", description: "", file_type: "", s3_url: "", is_public: false });
        setSelectedFile(null);
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to upload document:", error);
    } finally {
      setUploading(false);
    }
  }

  async function handleShareWithClient(e: React.FormEvent) {
    e.preventDefault();
    if (!showShareModal || !shareForm.client_user_id) return;

    try {
      const res = await fetch(`/api/documents/${showShareModal.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_user_id: shareForm.client_user_id,
          can_download: shareForm.can_download,
        }),
      });

      if (res.ok) {
        setShareForm({ client_user_id: "", can_download: true });
        fetchDocumentShares(showShareModal.id);
      }
    } catch (error) {
      console.error("Failed to share document:", error);
    }
  }

  async function handleRevokeAccess(documentId: string, clientUserId: string) {
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_user_id: clientUserId }),
      });

      if (res.ok) {
        fetchDocumentShares(documentId);
      }
    } catch (error) {
      console.error("Failed to revoke access:", error);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }

  const filteredDocuments = documents.filter((doc) =>
    searchTerm
      ? doc.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text)/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
          />
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="tl-btn px-4 py-3 text-sm whitespace-nowrap"
        >
          + Add Document
        </button>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
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
          <p className="text-(--text)/60">
            {searchTerm ? "No documents match your search" : "No documents yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="tl-card p-4 flex items-start gap-4"
            >
              <div className="text-3xl shrink-0">
                {FILE_TYPE_ICONS[doc.file_type || "other"]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-(--text)">{doc.display_name}</h4>
                    <p className="text-xs text-(--text)/60">{doc.filename}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.s3_url && (
                      <a
                        href={doc.s3_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-(--bg) rounded-lg transition"
                        title="Download"
                      >
                        <svg className="w-4 h-4 text-(--text)/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setShowShareModal(doc);
                        fetchDocumentShares(doc.id);
                      }}
                      className="p-2 hover:bg-(--bg) rounded-lg transition"
                      title="Share with clients"
                    >
                      <svg className="w-4 h-4 text-(--text)/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                    {userRole === "admin" && (
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition"
                        title="Delete"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {doc.description && (
                  <p className="text-sm text-(--text)/70 mt-1">{doc.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-(--text)/50">
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  {doc.uploader_name && <span>by {doc.uploader_name}</span>}
                  {doc.work_order_number && <span>WO: {doc.work_order_number}</span>}
                  {doc.project_name && <span>Project: {doc.project_name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10000 p-4" onClick={() => setShowUploadModal(false)}>
          <div className="tl-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-4">Add Document</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Display Name *</label>
                <input
                  type="text"
                  value={uploadForm.display_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, display_name: e.target.value })}
                  required
                  placeholder="Invoice - January 2024"
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Description</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">File Type</label>
                <select
                  value={uploadForm.file_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, file_type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="">Select type</option>
                  <option value="pdf">PDF</option>
                  <option value="doc">Document</option>
                  <option value="xls">Spreadsheet</option>
                  <option value="image">Image</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Document URL (optional)</label>
                <input
                  type="url"
                  value={uploadForm.s3_url}
                  onChange={(e) => setUploadForm({ ...uploadForm, s3_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
                <p className="text-xs text-(--text)/50 mt-1">
                  Direct link to the document file (S3, Google Drive, etc.)
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {uploading ? "Adding..." : "Add Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10000 p-4" onClick={() => setShowShareModal(null)}>
          <div className="tl-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-(--text) mb-2">Share Document</h3>
            <p className="text-sm text-(--text)/70 mb-4">{showShareModal.display_name}</p>

            {/* Share Form */}
            <form onSubmit={handleShareWithClient} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">Share with Client</label>
                <select
                  value={shareForm.client_user_id}
                  onChange={(e) => setShareForm({ ...shareForm, client_user_id: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.first_name} {client.last_name} ({client.email})
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareForm.can_download}
                  onChange={(e) => setShareForm({ ...shareForm, can_download: e.target.checked })}
                  className="w-4 h-4 rounded border-(--border) text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-(--text)">Allow download</span>
              </label>
              <button
                type="submit"
                disabled={!shareForm.client_user_id}
                className="w-full tl-btn px-4 py-2.5 text-sm disabled:opacity-50"
              >
                Share
              </button>
            </form>

            {/* Current Shares */}
            <div className="border-t border-(--border) pt-4">
              <h4 className="text-sm font-medium text-(--text) mb-3">Shared With</h4>
              {loadingShares ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-(--text)"></div>
                </div>
              ) : documentShares.length === 0 ? (
                <p className="text-sm text-(--text)/60">Not shared with anyone yet</p>
              ) : (
                <div className="space-y-2">
                  {documentShares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-(--bg)"
                    >
                      <div>
                        <p className="text-sm font-medium text-(--text)">
                          {share.client_name || share.client_email}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-(--text)/50">
                          {share.viewed_at && <span>Viewed</span>}
                          {share.downloaded_at && <span>Downloaded</span>}
                          {!share.viewed_at && !share.downloaded_at && <span>Not viewed</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeAccess(showShareModal.id, share.client_user_id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowShareModal(null)}
              className="w-full mt-4 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
