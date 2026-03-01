"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function validateToken() {
      setValidating(true);
      setError("");

      if (!token) {
        setTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setTokenValid(false);
          setError(data.error || "This reset link is invalid or expired.");
          return;
        }

        setTokenValid(true);
      } catch {
        setTokenValid(false);
        setError("Unable to validate reset link.");
      } finally {
        setValidating(false);
      }
    }

    void validateToken();
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
        return;
      }

      setSuccessMessage("Password reset successful. Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-linear-to-br from-(--tl-navy) via-(--tl-deep) to-(--tl-navy) text-white flex items-center justify-center px-4">
      <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.25),rgba(1,183,231,0))] blur-2xl" />
      <div className="pointer-events-none absolute left-[-120px] top-[320px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.25),rgba(123,168,179,0))] blur-2xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-(--text)">
            Taylor Leonard Corp
          </p>
          <h1 className="text-3xl font-semibold text-white mt-2">
            Reset Password
          </h1>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          {validating ? (
            <p className="text-sm text-(--text)">Validating reset link...</p>
          ) : !tokenValid ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-400/40 rounded-2xl text-red-100 text-sm">
                {error || "This reset link is invalid or expired."}
              </div>
              <p className="text-center text-sm text-(--text)">
                <Link href="/forgot-password" className="hover:underline">
                  Request a new reset link
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-400/40 rounded-2xl text-red-100 text-sm">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-300/40 rounded-2xl text-emerald-100 text-sm">
                  {successMessage}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-(--text) mb-2">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-(--text) mb-2">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                    placeholder="Repeat password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full tl-btn px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-(--text)">
            <Link href="/login" className="hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordFallback() {
  return (
    <div className="relative min-h-screen bg-linear-to-br from-(--tl-navy) via-(--tl-deep) to-(--tl-navy) text-white flex items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-3xl p-8 shadow-2xl">
          <p className="text-sm text-(--text)">Loading reset page...</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
