"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "employee" | "client";
}

const adminNavItems = [
  {
    label: "Dashboard",
    href: "/dashboard/admin",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/dashboard/projects",
    matchPrefix: "/dashboard/projects",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: "Work Orders",
    href: "/dashboard/management",
    matchPrefix: "/dashboard/management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/dashboard/users",
    matchPrefix: "/dashboard/users",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/admin#settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Persist sidebar collapse preference
  useEffect(() => {
    const stored = localStorage.getItem("dashboard-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard-sidebar-collapsed", String(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function isNavActive(item: (typeof adminNavItems)[0]) {
    if (item.matchPrefix) {
      return pathname.startsWith(item.matchPrefix);
    }
    return pathname === item.href || pathname === item.href.split("#")[0];
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-(--bg) flex items-center justify-center">
        <div className="text-(--text)">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const roleLabel = {
    admin: "Administrator",
    employee: "Employee",
    client: "Client",
  };

  const roleColor = {
    admin:
      "bg-(--bg)/30 text-blue-100 border border-(--border)/60",
    employee:
      "bg-(--bg)/30 text-blue-100 border border-(--border)/60",
    client:
      "bg-(--bg)/40 text-(--text) border border-(--border)/70",
  };

  return (
    <div className="relative min-h-screen bg-(--bg)">
      <div className="pointer-events-none absolute -top-32 right-[-140px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(1,183,231,0.15),rgba(1,183,231,0))] blur-3xl" />
      <div className="pointer-events-none absolute left-[-120px] top-[280px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(123,168,179,0.18),rgba(123,168,179,0))] blur-3xl" />

      <header className="sticky top-0 z-40 bg-[rgba(1,34,79,0.95)] backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className={`mx-auto px-4 md:px-6 py-2 md:py-3 flex items-center justify-between ${isAdmin ? "" : "max-w-6xl"}`}>
          <div className="flex items-center gap-3 md:gap-6">
            {/* Mobile sidebar toggle for admin */}
            {isAdmin && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
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

      {isAdmin ? (
        <div className="flex">
          {/* Desktop Sidebar */}
          <aside
            className={`hidden lg:flex flex-col shrink-0 sticky top-[57px] h-[calc(100vh-57px)] bg-[rgba(1,34,79,0.97)] border-r border-white/10 transition-[width] duration-200 ease-out ${
              sidebarCollapsed ? "w-16" : "w-56"
            }`}
          >
            <nav className={`flex-1 py-4 overflow-y-auto ${sidebarCollapsed ? "px-2 space-y-1" : "px-3 space-y-1"}`}>
              {adminNavItems.map((item) => {
                const active = isNavActive(item);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex items-center rounded-xl text-sm font-medium transition ${
                      sidebarCollapsed
                        ? "justify-center p-2.5"
                        : "gap-3 px-3 py-2.5"
                    } ${
                      active
                        ? "bg-white/15 text-white shadow-lg"
                        : "text-white/60 hover:bg-white/8 hover:text-white/90"
                    }`}
                  >
                    {item.icon}
                    {!sidebarCollapsed && item.label}
                  </Link>
                );
              })}
            </nav>
            <div className={`border-t border-white/10 ${sidebarCollapsed ? "px-2 py-3" : "px-3 py-4"}`}>
              {sidebarCollapsed ? (
                <div
                  className="flex justify-center"
                  title={`${user.first_name} ${user.last_name}`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-medium text-white/90">
                    {(user.first_name?.[0] || "") + (user.last_name?.[0] || "") || "?"}
                  </span>
                </div>
              ) : (
                <div className="px-3 py-2">
                  <p className="text-xs text-white/40 uppercase tracking-wider">Logged in as</p>
                  <p className="text-sm text-white/80 font-medium truncate mt-0.5">
                    {user.first_name} {user.last_name}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-white/60 transition hover:bg-white/10 hover:text-white/90 ${
                  sidebarCollapsed ? "px-0" : "px-3"
                }`}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <svg
                  className={`h-5 w-5 shrink-0 transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
                {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
              </button>
            </div>
          </aside>

          {/* Mobile Sidebar Overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setSidebarOpen(false)}
              />
              <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[rgba(1,34,79,0.99)] shadow-2xl flex flex-col animate-[slide-in_200ms_ease-out]">
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/NoTextLogoFIXED.png"
                      alt="Taylor Leonard Corp"
                      width={32}
                      height={32}
                      className="h-8 w-8"
                    />
                    <span className="text-sm font-medium text-white/80">TL Corp</span>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 transition"
                    aria-label="Close menu"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                  {adminNavItems.map((item) => {
                    const active = isNavActive(item);
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition ${
                          active
                            ? "bg-white/15 text-white shadow-lg"
                            : "text-white/60 hover:bg-white/8 hover:text-white/90"
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="px-3 py-4 border-t border-white/10">
                  <div className="px-3 py-2">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Logged in as</p>
                    <p className="text-sm text-white/80 font-medium truncate mt-0.5">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-white/40 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/10 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* Main Content with sidebar offset */}
          <main className="relative z-10 flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-4 md:py-8 max-w-6xl mx-auto">
            {children}
          </main>
        </div>
      ) : (
        /* Non-admin layout: no sidebar */
        <main className="relative z-10 mx-auto max-w-6xl px-4 md:px-6 py-4 md:py-8">
          {children}
        </main>
      )}
    </div>
  );
}
