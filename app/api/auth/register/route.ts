import { createUser, createSession, getUserByEmail } from "@/lib/auth";
import { processPendingInvitationsForUser } from "@/lib/projects";
import {
  acceptEmployeeInvitation,
  getEmployeeInvitationByToken,
} from "@/lib/employees";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, role, employeeInviteToken } = body;

    if (!email || !password || !firstName || !lastName) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const requestedRole =
      typeof role === "string" && ["client", "employee", "admin"].includes(role)
        ? role
        : "client";

    let userRole: "client" | "employee" | "admin" =
      requestedRole === "admin" ? "admin" : "client";

    let employeeInviteTokenToAccept: string | null = null;
    if (requestedRole === "employee") {
      if (!employeeInviteToken || typeof employeeInviteToken !== "string") {
        return Response.json(
          { error: "Employee registration requires a valid invite link" },
          { status: 403 }
        );
      }

      const invitation = await getEmployeeInvitationByToken(employeeInviteToken);
      if (!invitation) {
        return Response.json({ error: "Employee invite not found" }, { status: 404 });
      }

      if (invitation.status !== "pending") {
        return Response.json(
          { error: "Employee invite is no longer active" },
          { status: 400 }
        );
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return Response.json({ error: "Employee invite has expired" }, { status: 400 });
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return Response.json(
          { error: "This invite is tied to a different email address" },
          { status: 400 }
        );
      }

      userRole = "employee";
      employeeInviteTokenToAccept = employeeInviteToken;
    }

    const user = await createUser(email, password, firstName, lastName, userRole);

    if (employeeInviteTokenToAccept) {
      await acceptEmployeeInvitation(employeeInviteTokenToAccept, user.id);
    }

    const session = await createSession(user.id);

    // Process any pending project invitations for this email
    const invitationsProcessed = await processPendingInvitationsForUser(email, user.id);
    if (invitationsProcessed > 0) {
      console.log(`Processed ${invitationsProcessed} pending invitation(s) for ${email}`);
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session_id", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(session.expires_at),
      path: "/",
    });

    return Response.json({ user, success: true, invitationsProcessed });
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

