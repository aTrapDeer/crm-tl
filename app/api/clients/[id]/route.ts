import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  getCrmClientById,
  updateCrmClient,
  resolveClientAddresses,
  createCrmClientPortalInvite,
} from "@/lib/crm-clients";
import { sendClientPortalInvitationEmail } from "@/lib/email";

async function getAdminUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  if (!session) return null;
  const user = await getUserById(session.user_id);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const client = await getCrmClientById(id);
    if (!client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    return Response.json({ client });
  } catch (error) {
    console.error("Error fetching CRM client:", error);
    return Response.json({ error: "Failed to load client" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const sendInvite = Boolean(body.send_invite);

    let patch: Parameters<typeof updateCrmClient>[1] = {};

    if (typeof body.full_name === "string") {
      patch.full_name = body.full_name.trim();
    }
    if (
      typeof body.address === "string" ||
      typeof body.service_address === "string" ||
      typeof body.billing_address === "string" ||
      body.service_same_as_address !== undefined ||
      body.billing_same_as_address !== undefined
    ) {
      const existing = await getCrmClientById(id);
      if (!existing) {
        return Response.json({ error: "Client not found" }, { status: 404 });
      }
      const addresses = resolveClientAddresses({
        address:
          typeof body.address === "string" ? body.address : existing.address || "",
        serviceSameAsAddress:
          body.service_same_as_address !== undefined
            ? Boolean(body.service_same_as_address)
            : existing.service_address === existing.address,
        serviceAddress:
          typeof body.service_address === "string"
            ? body.service_address
            : existing.service_address || "",
        billingSameAsAddress:
          body.billing_same_as_address !== undefined
            ? Boolean(body.billing_same_as_address)
            : existing.billing_address === existing.address,
        billingAddress:
          typeof body.billing_address === "string"
            ? body.billing_address
            : existing.billing_address || "",
      });
      patch = { ...patch, ...addresses };
    }

    const client = await updateCrmClient(id, patch);
    if (!client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    let updated = client;
    if (sendInvite && !client.user_id) {
      updated = (await createCrmClientPortalInvite(client.id, user.id)) || client;
      if (updated.invitation_token) {
        await sendClientPortalInvitationEmail({
          to: updated.email,
          clientName: updated.full_name,
          inviteToken: updated.invitation_token,
          inviterName: `${user.first_name} ${user.last_name}`,
        });
      }
    }

    return Response.json({ client: updated });
  } catch (error) {
    console.error("Error updating CRM client:", error);
    return Response.json({ error: "Failed to update client" }, { status: 500 });
  }
}
