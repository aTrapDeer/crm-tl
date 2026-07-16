"use client";

import { useState } from "react";

interface BackupResponse {
  key: string;
  bucket: string;
  dumpBytes: number;
  uploadedBytes: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminBackupPanel({ nextBackupLabel }: { nextBackupLabel: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onBackupNow() {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/backup-db", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Backup failed.");
        return;
      }
      const result = data as BackupResponse;
      setSuccess(
        `Backup uploaded to ${result.bucket} (${formatBytes(result.uploadedBytes)} compressed).`,
      );
    } catch {
      setError("Unable to run a backup right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="tl-card p-6 md:p-8 max-w-xl">
      <p className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
        Admin Tools
      </p>
      <h2 className="mt-2 text-lg font-semibold text-(--text)">Database Backups</h2>
      <p className="mt-1 text-sm text-(--text)">
        The Turso database is dumped and saved to S3 every night at midnight Central.
      </p>
      <p className="mt-3 text-sm text-(--text)">
        <span className="font-medium">Next automatic backup:</span> {nextBackupLabel}
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}

      <button
        type="button"
        onClick={onBackupNow}
        disabled={pending}
        className="tl-btn mt-5 px-5 py-2.5 text-sm disabled:opacity-60"
      >
        {pending ? "Backing up..." : "Back Up Now"}
      </button>
    </section>
  );
}
