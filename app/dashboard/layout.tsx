"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="text-(--text)">Loading...</div>
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
    admin:
      "bg-(--bg)/30 text-blue-100 border border-(--border)/60",
    worker:
      "bg-(--bg)/30 text-blue-100 border border-(--border)/60",
    client:
      "bg-(--bg)/40 text-(--text) border border-(--border)/70",
  };

  return (
    <div className="relative min-h-screen bg-(--bg)">
      <div className="pointer-events-none absolute -top-32 right-[-140px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.15),rgba(1,183,231,0))] blur-3xl" />
      <div className="pointer-events-none absolute left-[-120px] top-[280px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.18),rgba(123,168,179,0))] blur-3xl" />

      <header className="sticky top-0 z-40 bg-[rgba(1,34,79,0.95)] backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-2 md:py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6">
            <Link href={`/dashboard/${user.role}`}>
              <Image
                src="/NoTextLogoFIXED.png"
                alt="Taylor Leonard Corp"
                width={36}
                height={36}
                className="h-8 w-8 md:h-9 md:w-9"
                priority
              />
            </Link>
            <div className="hidden sm:block">
              <p className="text-xs md:text-sm font-medium text-white/70 uppercase tracking-wider">
                Taylor Leonard Corp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-right">
              <p className="text-xs md:text-sm font-medium text-white">
                {user.first_name} {user.last_name}
              </p>
              <span
                className={`inline-block text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 rounded-full ${roleColor[user.role]}`}
              >
                {roleLabel[user.role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="tl-btn-outline px-3 md:px-4 py-1.5 md:py-2 text-xs"
            >
              <span className="hidden sm:inline">Sign Out</span>
              <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 md:px-6 py-4 md:py-8">
        {children}
      </main>
    </div>
  );
}



