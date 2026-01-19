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
    <div className="relative min-h-screen bg-gradient-to-br from-(--tl-navy) via-(--tl-deep) to-(--tl-navy) text-white flex items-center justify-center px-4">
      <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.25),rgba(1,183,231,0))] blur-2xl" />
      <div className="pointer-events-none absolute left-[-120px] top-[320px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.25),rgba(123,168,179,0))] blur-2xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-(--text)">
            Taylor Leonard Corp
          </p>
          <h1 className="text-3xl font-semibold text-white mt-2">
            Portal Login
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-400/40 rounded-2xl text-red-100 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-(--text) mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-(--text) mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                placeholder="********"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full tl-btn px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="mt-6 text-center text-sm text-(--text)">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-(--text) font-medium hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-(--text)">
          <Link href="/" className="hover:text-white transition">
            &lt;- Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}


