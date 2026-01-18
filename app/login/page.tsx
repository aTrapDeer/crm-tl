"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Redirect based on role
      if (data.user.role === "admin") {
        router.push("/dashboard/admin");
      } else if (data.user.role === "worker") {
        router.push("/dashboard/worker");
      } else {
        router.push("/dashboard/client");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--tl-offwhite)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tl-mid)]">
            Taylor Leonard Corp
          </p>
          <h1 className="text-3xl font-semibold text-[color:var(--tl-navy)] mt-2">
            Portal Login
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[color:var(--tl-sand)] p-8 shadow-[0_20px_50px_rgba(1,34,79,0.08)]"
        >
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)] focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)] focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-[color:var(--tl-navy)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(1,34,79,0.2)] transition hover:bg-[color:var(--tl-deep)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="mt-6 text-center text-sm text-[color:var(--tl-mid)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-[color:var(--tl-royal)] font-medium hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-[color:var(--tl-mid)]">
          <Link href="/" className="hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

