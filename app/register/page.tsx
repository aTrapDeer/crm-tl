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
    <div className="min-h-screen bg-[color:var(--tl-offwhite)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tl-mid)]">
            Taylor Leonard Corp
          </p>
          <h1 className="text-3xl font-semibold text-[color:var(--tl-navy)] mt-2">
            Create Account
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2"
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
                  className="w-full px-4 py-3 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)] focus:border-transparent transition"
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2"
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
                  className="w-full px-4 py-3 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)] focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2"
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
                className="w-full px-4 py-3 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)] focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2"
              >
                Account Type
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)] focus:border-transparent transition"
              >
                <option value="client">Client</option>
                <option value="worker">Worker</option>
                <option value="admin">Admin</option>
              </select>
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
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-[color:var(--tl-sand)] bg-[color:var(--tl-offwhite)] text-[color:var(--tl-navy)] focus:outline-none focus:ring-2 focus:ring-[color:var(--tl-cyan)] focus:border-transparent transition"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-[color:var(--tl-navy)] mb-2"
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
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="mt-6 text-center text-sm text-[color:var(--tl-mid)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[color:var(--tl-royal)] font-medium hover:underline"
            >
              Sign in
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

