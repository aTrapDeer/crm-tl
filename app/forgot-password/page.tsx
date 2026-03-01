"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to process request.");
        return;
      }

      setSuccessMessage(
        data.message ||
          "If an account exists for that email, a password reset link has been sent."
      );
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
            Forgot Password
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 shadow-2xl">
          <p className="text-sm text-(--text) mb-5">
            Enter your email and we&apos;ll send a reset link if the account exists.
          </p>

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

          <label className="block text-sm font-medium text-(--text) mb-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full tl-btn px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending..." : "Send Reset Link"}
          </button>

          <p className="mt-6 text-center text-sm text-(--text)">
            <Link href="/login" className="text-(--text) font-medium hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
