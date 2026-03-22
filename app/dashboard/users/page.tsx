"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalLayer } from "@/app/components/ModalLayer";

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

interface EmployeeInvitation {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  created_at: string;
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
  const [invitations, setInvitations] = useState<EmployeeInvitation[]>([]);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
  });
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<User | null>(null);
  const [pendingRoleEditUser, setPendingRoleEditUser] = useState<User | null>(null);
  const [roleDraft, setRoleDraft] = useState<User["role"]>("employee");
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<string | null>(null);
  const [pendingPasswordResetUser, setPendingPasswordResetUser] = useState<User | null>(null);
  const [userActionError, setUserActionError] = useState("");
  const [userActionSuccess, setUserActionSuccess] = useState("");

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

        const inviteRes = await fetch("/api/employees/invitations");
        if (inviteRes.ok) {
          const inviteData = await inviteRes.json();
          setInvitations(inviteData.invitations || []);
        }
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

  async function handleInviteEmployee(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setInviteLoading(true);

    try {
      const res = await fetch("/api/employees/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
        return;
      }

      setInviteSuccess(`Invitation sent to ${inviteForm.email}`);
      setInviteForm({ email: "", firstName: "", lastName: "" });
      setInvitations((prev) => [data.invitation, ...prev]);
    } catch (err) {
      console.error("Failed to invite employee:", err);
      setInviteError("Unable to send invite right now.");
    } finally {
      setInviteLoading(false);
    }
  }

  function handleRequestDeleteUser(target: User) {
    setPendingDeleteUser(target);
  }

  function openRoleEditor(target: User) {
    setPendingRoleEditUser(target);
    setRoleDraft(target.role);
    setUserActionError("");
    setUserActionSuccess("");
  }

  async function handleSaveUserRole() {
    if (!pendingRoleEditUser || updatingRoleUserId) return;
    setUserActionError("");
    setUserActionSuccess("");
    setUpdatingRoleUserId(pendingRoleEditUser.id);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-role",
          userId: pendingRoleEditUser.id,
          role: roleDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUserActionError(data.error || "Failed to update role.");
        return;
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === pendingRoleEditUser.id
            ? { ...user, role: roleDraft }
            : user
        )
      );
      setPendingRoleEditUser(null);
      setUserActionSuccess("User role updated successfully.");
    } catch (err) {
      console.error("Failed to update user role:", err);
      setUserActionError("Unable to update role right now.");
    } finally {
      setUpdatingRoleUserId(null);
    }
  }

  async function handleSendPasswordReset(target: User) {
    if (resettingPasswordUserId) return;
    setUserActionError("");
    setUserActionSuccess("");
    setResettingPasswordUserId(target.id);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-password-reset",
          userId: target.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUserActionError(data.error || "Failed to send password reset.");
        return;
      }

      setUserActionSuccess(`Password reset sent to ${target.email}.`);
    } catch (err) {
      console.error("Failed to send password reset:", err);
      setUserActionError("Unable to send password reset right now.");
    } finally {
      setResettingPasswordUserId(null);
    }
  }

  function requestPasswordReset(target: User) {
    setPendingPasswordResetUser(target);
    setUserActionError("");
    setUserActionSuccess("");
  }

  async function handleConfirmPasswordReset() {
    if (!pendingPasswordResetUser) return;
    const target = pendingPasswordResetUser;
    await handleSendPasswordReset(target);
    setPendingPasswordResetUser(null);
  }

  async function handleConfirmDeleteUser() {
    if (deletingUserId || !pendingDeleteUser) return;
    const target = pendingDeleteUser;
    setError("");
    setDeletingUserId(target.id);

    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to delete user.");
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setPendingDeleteUser(null);
    } catch (err) {
      console.error("Failed to delete user:", err);
      setError("Unable to delete user right now.");
    } finally {
      setDeletingUserId(null);
    }
  }

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
        <div className="mb-6 pb-6 border-b border-(--border)">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-(--text)/60">
                Employee Onboarding
              </p>
              <h2 className="mt-1 text-lg font-semibold text-(--text)">
                Invite Employee
              </h2>
              <p className="text-sm text-(--text) mt-1">
                Send an employee invite link and onboarding access by email.
              </p>
            </div>
            <p className="text-xs text-(--text)/70">
              Pending invites: {invitations.length}
            </p>
          </div>

          <form
            onSubmit={handleInviteEmployee}
            className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto]"
          >
            <input
              type="text"
              placeholder="First name (optional)"
              value={inviteForm.firstName}
              onChange={(e) =>
                setInviteForm((prev) => ({ ...prev, firstName: e.target.value }))
              }
              className="px-3 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
            />
            <input
              type="text"
              placeholder="Last name (optional)"
              value={inviteForm.lastName}
              onChange={(e) =>
                setInviteForm((prev) => ({ ...prev, lastName: e.target.value }))
              }
              className="px-3 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
            />
            <input
              type="email"
              placeholder="employee@company.com"
              value={inviteForm.email}
              onChange={(e) =>
                setInviteForm((prev) => ({ ...prev, email: e.target.value }))
              }
              required
              className="px-3 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
            />
            <button
              type="submit"
              disabled={inviteLoading}
              className="tl-btn px-4 py-2.5 text-sm disabled:opacity-60"
            >
              {inviteLoading ? "Sending..." : "Send Invite"}
            </button>
          </form>

          {inviteError && (
            <p className="mt-3 text-sm text-red-600">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="mt-3 text-sm text-emerald-700">{inviteSuccess}</p>
          )}

          {invitations.length > 0 && (
            <div className="mt-4 grid gap-2">
              {invitations.slice(0, 5).map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-xl border border-(--border) bg-(--bg) px-3 py-2.5 text-sm text-(--text)"
                >
                  <span className="font-medium">{invite.email}</span>
                  <span className="text-(--text)/70">
                    {" "}
                    - expires {new Date(invite.expires_at).toLocaleDateString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <svg
            className="pointer-events-none w-4 h-4 text-(--text)/60 absolute left-3.5 top-1/2 -translate-y-1/2"
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
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
          />
        </div>
        {userActionError && (
          <p className="mt-3 text-sm text-red-600">{userActionError}</p>
        )}
        {userActionSuccess && (
          <p className="mt-3 text-sm text-emerald-700">{userActionSuccess}</p>
        )}
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-(--text) truncate" title={`${user.first_name} ${user.last_name}`}>
                          {user.first_name} {user.last_name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={updatingRoleUserId === user.id || currentUser?.id === user.id}
                            onClick={() => openRoleEditor(user)}
                            className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 p-1.5 text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Edit role for ${user.first_name} ${user.last_name}`}
                            title={currentUser?.id === user.id ? "You cannot change your own role" : "Edit role"}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 013 3L12 14l-4 1 1-4 7.5-7.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            disabled={resettingPasswordUserId === user.id}
                            onClick={() => requestPasswordReset(user)}
                            className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 p-1.5 text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Send password reset for ${user.first_name} ${user.last_name}`}
                            title="Send password reset"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm0 0v3m-6 0h12a2 2 0 012 2v1H4v-1a2 2 0 012-2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            disabled={deletingUserId === user.id || currentUser?.id === user.id}
                            onClick={() => handleRequestDeleteUser(user)}
                            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${user.first_name} ${user.last_name}`}
                            title={currentUser?.id === user.id ? "You cannot delete your own account" : "Delete user"}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
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

      {pendingRoleEditUser && (
        <ModalLayer
          align="sheet"
          className="bg-black/50"
          onBackdropClick={() => !updatingRoleUserId && setPendingRoleEditUser(null)}
        >
          <div
            className="tl-card w-full max-w-md rounded-none md:rounded-3xl p-5 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text)">Update User Role</h3>
            <p className="mt-2 text-sm text-(--text)">
              Change role for{" "}
              <span className="font-semibold">
                {pendingRoleEditUser.first_name} {pendingRoleEditUser.last_name}
              </span>{" "}
              ({pendingRoleEditUser.email}).
            </p>

            <label className="block mt-4">
              <span className="text-xs font-medium text-(--text)/70 uppercase tracking-[0.16em]">
                Role
              </span>
              <select
                value={roleDraft}
                onChange={(event) => setRoleDraft(event.target.value as User["role"])}
                className="mt-1 w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
              >
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
                <option value="client">Client</option>
              </select>
            </label>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingRoleEditUser(null)}
                disabled={Boolean(updatingRoleUserId)}
                className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveUserRole()}
                disabled={Boolean(updatingRoleUserId)}
                className="flex-1 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {updatingRoleUserId ? "Saving..." : "Save Role"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}

      {pendingDeleteUser && (
        <ModalLayer
          align="sheet"
          className="bg-black/50"
          onBackdropClick={() => !deletingUserId && setPendingDeleteUser(null)}
        >
          <div
            className="tl-card w-full max-w-md rounded-none md:rounded-3xl p-5 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text)">Delete User</h3>
            <p className="mt-2 text-sm text-(--text)">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {pendingDeleteUser.first_name} {pendingDeleteUser.last_name}
              </span>{" "}
              ({pendingDeleteUser.email})?
            </p>
            <p className="mt-1 text-sm text-red-600">This action cannot be undone.</p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                disabled={Boolean(deletingUserId)}
                className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={Boolean(deletingUserId)}
                className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingUserId ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}

      {pendingPasswordResetUser && (
        <ModalLayer
          align="sheet"
          className="bg-black/50"
          onBackdropClick={() => !resettingPasswordUserId && setPendingPasswordResetUser(null)}
        >
          <div
            className="tl-card w-full max-w-md rounded-none md:rounded-3xl p-5 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-(--text)">Confirm Password Reset</h3>
            <p className="mt-2 text-sm text-(--text)">
              Send a password reset email to{" "}
              <span className="font-semibold">
                {pendingPasswordResetUser.first_name} {pendingPasswordResetUser.last_name}
              </span>{" "}
              ({pendingPasswordResetUser.email})?
            </p>
            <p className="mt-1 text-sm text-amber-700">
              This generates a new temporary password and invalidates their current password.
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPendingPasswordResetUser(null)}
                disabled={Boolean(resettingPasswordUserId)}
                className="flex-1 rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPasswordReset()}
                disabled={Boolean(resettingPasswordUserId)}
                className="flex-1 rounded-full bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
              >
                {resettingPasswordUserId ? "Sending..." : "Confirm Reset"}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}
    </div>
  );
}
