import { cookies } from "next/headers";
import { getSession, getUserById, getUserByEmail } from "@/lib/auth";
import {
  listCrmClients,
  upsertCrmClient,
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

export async function GET(request: Request) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = new URL(request.url).searchParams.get("email");
    if (email) {
      const { getCrmClientByEmail } = await import("@/lib/crm-clients");
      const client = await getCrmClientByEmail(email);
      return Response.json({ client });
    }

    const clients = await listCrmClients();
    return Response.json({ clients });
  } catch (error) {
    console.error("Error listing CRM clients:", error);
    return Response.json({ error: "Failed to load clients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const sendInvite = Boolean(body.send_invite);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!fullName) {
      return Response.json({ error: "Full name is required" }, { status: 400 });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser && existingUser.role !== "client") {
      return Response.json(
        { error: "This email belongs to a non-client account." },
        { status: 409 }
      );
    }

    const addresses = resolveClientAddresses({
      address: typeof body.address === "string" ? body.address : "",
      serviceSameAsAddress: Boolean(body.service_same_as_address),
      serviceAddress: typeof body.service_address === "string" ? body.service_address : "",
      billingSameAsAddress: Boolean(body.billing_same_as_address),
      billingAddress: typeof body.billing_address === "string" ? body.billing_address : "",
    });

    const client = await upsertCrmClient({
      email,
      full_name: fullName,
      address: addresses.address || undefined,
      service_address: addresses.service_address || undefined,
      billing_address: addresses.billing_address || undefined,
      user_id: existingUser?.id ?? null,
    });

    let updated = client;
    if (sendInvite && !existingUser) {
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
    console.error("Error creating CRM client:", error);
    return Response.json({ error: "Failed to save client" }, { status: 500 });
  }
}
