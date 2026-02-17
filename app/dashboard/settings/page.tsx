"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SessionUser {
  id: string;
  role: "admin" | "employee" | "client";
  first_name?: string;
  last_name?: string;
  email?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!data.user) {
          router.push("/login");
          return;
        }
        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [router]);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("All password fields are required.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to change password.");
        return;
      }

      setSuccess("Password updated successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setError("Unable to change password right now.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--border)" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <section className="tl-card p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-(--text)/60">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-(--text)">Account Settings</h1>
        <p className="mt-2 text-sm text-(--text)">
          Manage your account preferences and security details.
        </p>
      </section>

      <section className="tl-card p-6 md:p-8 max-w-xl">
        <h2 className="text-lg font-semibold text-(--text)">Change Password</h2>
        <p className="mt-1 text-sm text-(--text)">
          Use at least 8 characters and keep this password private.
        </p>

        <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-(--text) mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, currentPassword: e.target.value }))
              }
              className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-(--text) mb-1">
              New Password
            </label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, newPassword: e.target.value }))
              }
              className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-(--text) mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
              className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
              required
              minLength={8}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="tl-btn px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
