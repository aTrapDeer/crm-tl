"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "client",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
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
    <div className="relative min-h-screen bg-gradient-to-br from-(--tl-navy) via-(--tl-deep) to-(--tl-navy) text-white flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.25),rgba(1,183,231,0))] blur-2xl" />
      <div className="pointer-events-none absolute left-[-120px] top-[320px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.25),rgba(123,168,179,0))] blur-2xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-(--text)">
            Taylor Leonard Corp
          </p>
          <h1 className="text-3xl font-semibold text-white mt-2">
            Create Account
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-400/40 rounded-2xl text-red-100 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-(--text) mb-2"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-(--text) mb-2"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-(--text) mb-2"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-(--text) mb-2"
              >
                Account Type
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
              >
                <option value="client">Client</option>
                <option value="worker">Worker</option>
                <option value="admin">Admin</option>
              </select>
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
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-full border border-white/20 bg-white/10 text-white placeholder:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-transparent transition"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-(--text) mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="mt-6 text-center text-sm text-(--text)">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-(--text) font-medium hover:underline"
            >
              Sign in
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


