"use client";

import { useEffect, useMemo, useState } from "react";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "employee" | "client";
}

interface SessionUser {
  id: string;
  role: "admin" | "employee" | "client";
}

const roleMeta = {
  admin: {
    label: "Admins",
    accent: "text-purple-700",
    badge: "bg-purple-100 text-purple-700",
    ring: "ring-purple-200/60",
  },
  employee: {
    label: "Employees",
    accent: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
    ring: "ring-blue-200/60",
  },
  client: {
    label: "Clients",
    accent: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-200/60",
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        setCurrentUser(sessionData.user || null);

        const usersRes = await fetch("/api/users");
        if (!usersRes.ok) {
          const body = await usersRes.json().catch(() => ({}));
          setError(body.error || "You do not have access to this page.");
          setLoading(false);
          return;
        }
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        setError("Unable to load users right now.");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) return users;
    return users.filter((user) => {
      return (
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery) ||
        user.role.toLowerCase().includes(lowerQuery)
      );
    });
  }, [users, query]);

  const groupedUsers = useMemo(() => {
    return filteredUsers.reduce(
      (acc, user) => {
        acc[user.role].push(user);
        return acc;
      },
      { admin: [] as User[], employee: [] as User[], client: [] as User[] }
    );
  }, [filteredUsers]);

  const totals = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      employees: users.filter((u) => u.role === "employee").length,
      clients: users.filter((u) => u.role === "client").length,
    };
  }, [users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-(--border)" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="tl-card p-8 text-center">
        <p className="text-(--text) font-medium">Restricted access</p>
        <p className="text-sm text-(--text) mt-2">
          Only administrators can view the users directory.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tl-card p-8 text-center">
        <p className="text-(--text) font-medium">{error}</p>
        <p className="text-sm text-(--text) mt-2">
          If you believe this is a mistake, contact an administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#0f172a_100%)] px-6 py-6 md:px-10 md:py-8 text-white shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(168,85,247,0.4),rgba(168,85,247,0))]" />
        <div className="absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.35),rgba(59,130,246,0))]" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between min-w-0">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.35em] text-white/70">
              People Directory
            </p>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold">
              Your CRM crew, organized by role.
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/75 max-w-2xl">
              Quickly scan admins, employees, and clients in a focused three-column
              view. Search across names and emails instantly.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm min-w-0">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur min-w-0 wrap-break-word overflow-hidden">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em] wrap-break-word">
                Total
              </p>
              <p className="text-2xl font-semibold break-all">{totals.total}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur min-w-0 wrap-break-word overflow-hidden">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em] wrap-break-word">
                Admins
              </p>
              <p className="text-2xl font-semibold break-all">{totals.admins}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur min-w-0 wrap-break-word overflow-hidden">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em] wrap-break-word">
                Employees
              </p>
              <p className="text-2xl font-semibold break-all">{totals.employees}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur min-w-0 wrap-break-word overflow-hidden">
              <p className="text-white/70 text-xs uppercase tracking-[0.2em] wrap-break-word">
                Clients
              </p>
              <p className="text-2xl font-semibold break-all">{totals.clients}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tl-card p-4 md:p-6">
        <div className="relative">
          <svg
            className="w-4 h-4 text-(--text)/60 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3 min-w-0">
        {(["admin", "employee", "client"] as const).map((role) => {
          const meta = roleMeta[role];
          const list = groupedUsers[role];
          return (
            <div key={role} className={`tl-card p-4 md:p-5 ring-1 min-w-0 ${meta.ring}`}>
              <div className="flex items-center justify-between mb-4 min-w-0 gap-2">
                <h2 className={`text-sm uppercase tracking-[0.28em] truncate ${meta.accent}`}>
                  {meta.label}
                </h2>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${meta.badge}`}>
                  {list.length}
                </span>
              </div>
              {list.length === 0 ? (
                <p className="text-sm text-(--text)">
                  No {meta.label.toLowerCase()} available.
                </p>
              ) : (
                <div className="space-y-3 min-w-0">
                  {list.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-(--border) bg-white px-4 py-3 shadow-sm transition hover:shadow-md min-w-0 overflow-hidden"
                    >
                      <p className="text-sm font-semibold text-(--text) truncate" title={`${user.first_name} ${user.last_name}`}>
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-(--text) mt-1 truncate" title={user.email}>
                        {user.email}
                      </p>
                      <span className={`inline-flex mt-3 text-[10px] px-2 py-1 rounded-full shrink-0 ${meta.badge}`}>
                        {user.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
