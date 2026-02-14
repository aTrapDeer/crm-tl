import { cookies } from "next/headers";
import { getSession, getUserById, getUserByEmail } from "@/lib/auth";
import {
  createEmployeeInvitation,
  getEmployeeInvitations,
} from "@/lib/employees";
import { sendEmployeeInvitationEmail } from "@/lib/email";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

export async function GET() {
  try {
    const user = await getAdminUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invitations = await getEmployeeInvitations("pending");
    return Response.json({ invitations });
  } catch (error) {
    console.error("Error fetching employee invitations:", error);
    return Response.json(
      { error: "Failed to fetch employee invitations" },
      { status: 500 }
    );
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
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

    if (!email || !isValidEmail(email)) {
      return Response.json({ error: "A valid email is required" }, { status: 400 });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return Response.json(
        {
          error:
            existingUser.role === "employee"
              ? "This email already belongs to an employee."
              : "This email already belongs to an existing account.",
        },
        { status: 409 }
      );
    }

    const invitation = await createEmployeeInvitation({
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      invited_by: user.id,
    });

    await sendEmployeeInvitationEmail({
      to: email,
      inviteToken: invitation.token,
      inviterName: `${user.first_name} ${user.last_name}`,
      employeeName:
        firstName || lastName
          ? `${firstName} ${lastName}`.trim()
          : undefined,
    });

    return Response.json({ invitation });
  } catch (error) {
    console.error("Error creating employee invitation:", error);
    return Response.json(
      { error: "Failed to create employee invitation" },
      { status: 500 }
    );
  }
}
