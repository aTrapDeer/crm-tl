"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_TL_CORP_ORGANIZATION,
  type TlCorpOrganizationInput,
} from "@/lib/tl-corp-organization-shared";

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
  const [testEmail, setTestEmail] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailError, setTestEmailError] = useState("");
  const [testEmailSuccess, setTestEmailSuccess] = useState("");
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [orgForm, setOrgForm] = useState<TlCorpOrganizationInput>(DEFAULT_TL_CORP_ORGANIZATION);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgSubmitting, setOrgSubmitting] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [orgSuccess, setOrgSuccess] = useState("");

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

        if (data.user.role === "admin") {
          setOrgLoading(true);
          try {
            const orgRes = await fetch("/api/settings/tl-corp-organization");
            const orgData = await orgRes.json().catch(() => ({}));
            if (orgRes.ok && orgData.organization) {
              const org = orgData.organization;
              setOrgForm({
                registration_label: org.registration_label,
                business_name: org.business_name,
                phone: org.phone,
                email: org.email,
                address_line1: org.address_line1,
                city_state: org.city_state,
                postal_code: org.postal_code,
                website: org.website,
              });
            }
          } catch {
            setOrgError("Unable to load organization settings.");
          } finally {
            setOrgLoading(false);
          }
        }
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

  async function handleSaveOrganization(e: FormEvent) {
    e.preventDefault();
    setOrgError("");
    setOrgSuccess("");

    setOrgSubmitting(true);
    try {
      const res = await fetch("/api/settings/tl-corp-organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgForm),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOrgError(data.error || "Failed to save organization settings.");
        return;
      }

      if (data.organization) {
        setOrgForm({
          registration_label: data.organization.registration_label,
          business_name: data.organization.business_name,
          phone: data.organization.phone,
          email: data.organization.email,
          address_line1: data.organization.address_line1,
          city_state: data.organization.city_state,
          postal_code: data.organization.postal_code,
          website: data.organization.website,
        });
      }

      setOrgSuccess("Organization settings saved. Estimates and invoices will use this information.");
    } catch {
      setOrgError("Unable to save organization settings right now.");
    } finally {
      setOrgSubmitting(false);
    }
  }

  async function handleSendTestEmail(e: FormEvent) {
    e.preventDefault();
    setTestEmailError("");
    setTestEmailSuccess("");

    const recipient = testEmail.trim();
    if (!recipient) {
      setTestEmailError("Enter an email address to test.");
      return;
    }

    setTestingEmail(true);
    try {
      const res = await fetch("/api/settings/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestEmailError(data.error || "Failed to send test email.");
        return;
      }

      setTestEmailSuccess(`Test email sent to ${recipient}.`);
      setTestEmail("");
    } catch {
      setTestEmailError("Unable to send a test email right now.");
    } finally {
      setTestingEmail(false);
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

      {user.role === "admin" && (
        <section className="tl-card p-6 md:p-8 max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
            Admin Tools
          </p>
          <h2 className="mt-2 text-lg font-semibold text-(--text)">TL Corp Organization</h2>
          <p className="mt-1 text-sm text-(--text)">
            Business registration details shown on project estimates and invoice PDFs.
          </p>

          {orgLoading ? (
            <p className="mt-5 text-sm text-(--text)/70">Loading organization settings...</p>
          ) : (
            <form onSubmit={handleSaveOrganization} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Registration Label
                </label>
                <input
                  type="text"
                  value={orgForm.registration_label}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, registration_label: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  placeholder="Business Registered at"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={orgForm.business_name}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, business_name: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={orgForm.phone}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  placeholder="3144893229"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={orgForm.email}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={orgForm.address_line1}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, address_line1: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    City / State
                  </label>
                  <input
                    type="text"
                    value={orgForm.city_state}
                    onChange={(e) =>
                      setOrgForm((prev) => ({ ...prev, city_state: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                    placeholder="ST. LOUIS MO"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-(--text) mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={orgForm.postal_code}
                    onChange={(e) =>
                      setOrgForm((prev) => ({ ...prev, postal_code: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                    placeholder="63123"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text) mb-1">
                  Website
                </label>
                <input
                  type="text"
                  value={orgForm.website}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, website: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                  placeholder="www.TLcorp.build"
                />
              </div>

              {orgError && <p className="text-sm text-red-600">{orgError}</p>}
              {orgSuccess && <p className="text-sm text-emerald-700">{orgSuccess}</p>}

              <button
                type="submit"
                disabled={orgSubmitting}
                className="tl-btn px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {orgSubmitting ? "Saving..." : "Save Organization"}
              </button>
            </form>
          )}
        </section>
      )}

      {user.role === "admin" && (
        <section className="tl-card p-6 md:p-8 max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
            Admin Tools
          </p>
          <h2 className="mt-2 text-lg font-semibold text-(--text)">Email Tester</h2>
          <p className="mt-1 text-sm text-(--text)">
            Send a predefined SES test email with the current date, time, and admin
            portal details to confirm the email service is running.
          </p>

          <form onSubmit={handleSendTestEmail} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-(--text) mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text)"
                placeholder="name@example.com"
                required
              />
            </div>

            {testEmailError && <p className="text-sm text-red-600">{testEmailError}</p>}
            {testEmailSuccess && (
              <p className="text-sm text-emerald-700">{testEmailSuccess}</p>
            )}

            <button
              type="submit"
              disabled={testingEmail}
              className="tl-btn px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {testingEmail ? "Sending..." : "Send Test Email"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
