import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  createBonanClientInvitation,
  getBonanClientInvitations,
} from "@/lib/bonan-client";
import { sendNotificationEmail } from "@/lib/email";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

function getAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can view Bonan invitations" }, { status: 403 });
    }

    const invitations = await getBonanClientInvitations();
    return Response.json({ invitations });
  } catch (error) {
    console.error("Error fetching Bonan invitations:", error);
    return Response.json({ error: "Failed to fetch Bonan invitations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can invite Bonan clients" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const invitation = await createBonanClientInvitation({
      email,
      invited_by: user.id,
    });

    await sendNotificationEmail({
      to: email,
      subject: "Bonan Towers portal invitation",
      title: "Bonan Towers client access",
      message: `${user.first_name} ${user.last_name} invited you to review Bonan Towers work orders, incidents, and report approvals.`,
      actionUrl: `${getAppUrl()}/register?bonanInvite=${invitation.token}`,
      actionLabel: "Create Account",
    });

    return Response.json({ invitation }, { status: 201 });
  } catch (error) {
    console.error("Error creating Bonan invitation:", error);
    return Response.json({ error: "Failed to create Bonan invitation" }, { status: 500 });
  }
}
