"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface Membership {
  id: string;
  user_id: string;
  company_name: string | null;
  display_name: string | null;
  user_name?: string;
  user_email?: string;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

interface ChangeRequest {
  id: string;
  entity_type: string;
  requested_area: string;
  status: string;
  requester_name?: string;
  created_at: string;
}

export default function BonanClientsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [membershipForm, setMembershipForm] = useState({
    user_id: "",
    company_name: "",
    display_name: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");

  async function loadData() {
    try {
      const [usersRes, membershipsRes, invitationsRes, requestsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/bonan/clients"),
        fetch("/api/bonan/client-invitations"),
        fetch("/api/bonan/change-requests"),
      ]);
      const [usersData, membershipsData, invitationsData, requestsData] = await Promise.all([
        usersRes.json().catch(() => ({})),
        membershipsRes.json().catch(() => ({})),
        invitationsRes.json().catch(() => ({})),
        requestsRes.json().catch(() => ({})),
      ]);

      if (!usersRes.ok || !membershipsRes.ok || !invitationsRes.ok || !requestsRes.ok) {
        setError("Failed to load Bonan operations data.");
        return;
      }

      setUsers((usersData.users || []).filter((user: User) => user.role === "client"));
      setMemberships(membershipsData.memberships || []);
      setInvitations(invitationsData.invitations || []);
      setChangeRequests(requestsData.changeRequests || []);
    } catch (fetchError) {
      console.error("Failed to load Bonan operations data:", fetchError);
      setError("Failed to load Bonan operations data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          router.push("/login");
          return;
        }
        if (sessionData.user.role !== "admin") {
          router.push("/dashboard/bonan");
          return;
        }
        await loadData();
      } catch {
        router.push("/login");
      }
    }

    void init();
  }, [router]);

  async function handleAddMembership() {
    if (!membershipForm.user_id) return;
    const res = await fetch("/api/bonan/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(membershipForm),
    });
    if (res.ok) {
      setMembershipForm({ user_id: "", company_name: "", display_name: "" });
      await loadData();
    }
  }

  async function handleRemoveMembership(id: string) {
    const res = await fetch(`/api/bonan/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadData();
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    const res = await fetch("/api/bonan/client-invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    if (res.ok) {
      setInviteEmail("");
      await loadData();
    }
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--text)/55">Bonan Towers</p>
            <h1 className="text-2xl font-bold text-(--text)">Client Operations</h1>
            <p className="text-sm text-(--text)/60 mt-1">Manage Bonan client access, invitations, and submitted correction requests.</p>
          </div>
          <Link href="/dashboard/bonan" className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text)">
            Back to Bonan
          </Link>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="tl-card p-6 text-sm text-(--text)/60">Loading Bonan operations...</div>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-(--border)/20 bg-white/90 p-4 space-y-3">
                <h2 className="text-lg font-semibold text-(--text)">Add Existing Client</h2>
                <select
                  value={membershipForm.user_id}
                  onChange={(event) => setMembershipForm((current) => ({ ...current, user_id: event.target.value }))}
                  className="w-full rounded-xl border border-(--border)/30 px-3 py-2.5 text-sm"
                >
                  <option value="">Select a client</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.email})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={membershipForm.display_name}
                  onChange={(event) => setMembershipForm((current) => ({ ...current, display_name: event.target.value }))}
                  placeholder="Display name"
                  className="w-full rounded-xl border border-(--border)/30 px-3 py-2.5 text-sm"
                />
                <input
                  type="text"
                  value={membershipForm.company_name}
                  onChange={(event) => setMembershipForm((current) => ({ ...current, company_name: event.target.value }))}
                  placeholder="Company name"
                  className="w-full rounded-xl border border-(--border)/30 px-3 py-2.5 text-sm"
                />
                <button type="button" onClick={() => void handleAddMembership()} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  Add Bonan Client
                </button>
              </div>

              <div className="rounded-2xl border border-(--border)/20 bg-white/90 p-4 space-y-3">
                <h2 className="text-lg font-semibold text-(--text)">Invite New Client</h2>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="client@example.com"
                  className="w-full rounded-xl border border-(--border)/30 px-3 py-2.5 text-sm"
                />
                <button type="button" onClick={() => void handleInvite()} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  Send Invitation
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-(--border)/20 bg-white/90 p-4">
              <h2 className="text-lg font-semibold text-(--text) mb-3">Active Bonan Clients</h2>
              <div className="space-y-3">
                {memberships.map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between gap-3 rounded-xl border border-(--border)/15 bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-(--text)">{membership.display_name || membership.user_name || "Bonan Client"}</p>
                      <p className="text-xs text-(--text)/55">{membership.company_name || membership.user_email}</p>
                    </div>
                    <button type="button" onClick={() => void handleRemoveMembership(membership.id)} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                      Remove
                    </button>
                  </div>
                ))}
                {memberships.length === 0 && <p className="text-sm text-(--text)/60">No Bonan clients have been added yet.</p>}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-(--border)/20 bg-white/90 p-4">
                <h2 className="text-lg font-semibold text-(--text) mb-3">Pending Invitations</h2>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="rounded-xl border border-(--border)/15 bg-slate-50 p-3">
                      <p className="text-sm font-medium text-(--text)">{invitation.email}</p>
                      <p className="text-xs text-(--text)/55 capitalize">{invitation.status} - {new Date(invitation.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {invitations.length === 0 && <p className="text-sm text-(--text)/60">No pending Bonan invitations.</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-(--border)/20 bg-white/90 p-4">
                <h2 className="text-lg font-semibold text-(--text) mb-3">Recent Correction Requests</h2>
                <div className="space-y-3">
                  {changeRequests.slice(0, 8).map((request) => (
                    <div key={request.id} className="rounded-xl border border-(--border)/15 bg-slate-50 p-3">
                      <p className="text-sm font-medium text-(--text)">{request.requester_name || "Client"} - {request.requested_area}</p>
                      <p className="text-xs text-(--text)/55 capitalize">
                        {request.entity_type.replace(/_/g, " ")} - {request.status.replace(/_/g, " ")}
                      </p>
                    </div>
                  ))}
                  {changeRequests.length === 0 && <p className="text-sm text-(--text)/60">No Bonan correction requests have been submitted.</p>}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
