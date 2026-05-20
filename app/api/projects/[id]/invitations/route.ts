import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  createProjectInvitation,
  getProjectInvitations,
} from "@/lib/projects";
import {
  upsertCrmClient,
  getCrmClientById,
  getCrmClientByEmail,
  resolveClientAddresses,
} from "@/lib/crm-clients";
import { sendInvitationEmail } from "@/lib/email";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can view invitations" }, { status: 403 });
    }

    const invitations = await getProjectInvitations(id);

    return Response.json({ invitations });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return Response.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return Response.json(
        { error: "Only admins can invite clients" },
        { status: 403 }
      );
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    let clientName: string | undefined;
    let crmClientId: string | null =
      typeof body.crm_client_id === "string" ? body.crm_client_id : null;

    if (crmClientId) {
      const existing = await getCrmClientById(crmClientId);
      if (!existing) {
        return Response.json({ error: "Client not found" }, { status: 404 });
      }
      email = existing.email;
      clientName = existing.full_name;
    } else if (body.client && typeof body.client === "object") {
      const c = body.client;
      email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
      const fullName = typeof c.full_name === "string" ? c.full_name.trim() : "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "Valid email is required" }, { status: 400 });
      }
      if (!fullName) {
        return Response.json({ error: "Full name is required" }, { status: 400 });
      }
      const addresses = resolveClientAddresses({
        address: typeof c.address === "string" ? c.address : "",
        serviceSameAsAddress: Boolean(c.service_same_as_address),
        serviceAddress: typeof c.service_address === "string" ? c.service_address : "",
        billingSameAsAddress: Boolean(c.billing_same_as_address),
        billingAddress: typeof c.billing_address === "string" ? c.billing_address : "",
      });
      const saved = await upsertCrmClient({
        email,
        full_name: fullName,
        address: addresses.address || undefined,
        service_address: addresses.service_address || undefined,
        billing_address: addresses.billing_address || undefined,
      });
      crmClientId = saved.id;
      clientName = saved.full_name;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    if (!clientName) {
      const profile = crmClientId
        ? await getCrmClientById(crmClientId)
        : await getCrmClientByEmail(email);
      clientName = profile?.full_name;
    }

    const invitation = await createProjectInvitation({
      project_id: id,
      email,
      invited_by: user.id,
      crm_client_id: crmClientId,
    });

    await sendInvitationEmail({
      to: email,
      projectName: project.name,
      inviterName: `${user.first_name} ${user.last_name}`,
      inviteToken: invitation.token,
      clientName,
    });

    return Response.json({ invitation, message: "Invitation sent successfully" });
  } catch (error) {
    console.error("Error creating invitation:", error);
    return Response.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
