"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "worker" | "client";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--tl-offwhite)] flex items-center justify-center">
        <div className="text-[color:var(--tl-mid)]">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const roleLabel = {
    admin: "Administrator",
    worker: "Worker",
    client: "Client",
  };

  const roleColor = {
    admin: "bg-purple-100 text-purple-700",
    worker: "bg-blue-100 text-blue-700",
    client: "bg-green-100 text-green-700",
  };

  return (
    <div className="min-h-screen bg-[color:var(--tl-offwhite)]">
      {/* Header */}
      <header className="bg-white border-b border-[color:var(--tl-sand)]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/dashboard/${user.role}`}>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--tl-mid)]">
                  Taylor Leonard Corp
                </p>
                <h1 className="text-lg font-semibold text-[color:var(--tl-navy)]">
                  CRM Portal
                </h1>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-[color:var(--tl-navy)]">
                {user.first_name} {user.last_name}
              </p>
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full ${roleColor[user.role]}`}
              >
                {roleLabel[user.role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-[color:var(--tl-mid)] hover:text-[color:var(--tl-navy)] transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

