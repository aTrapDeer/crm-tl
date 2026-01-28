import { createUser, createSession, getUserByEmail } from "@/lib/auth";
import { processPendingInvitationsForUser } from "@/lib/projects";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, role } = body;

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

    // Validate role (default to client, restrict admin creation later)
    const validRoles = ["client", "employee", "admin"];
    const userRole = validRoles.includes(role) ? role : "client";

    const user = await createUser(email, password, firstName, lastName, userRole);
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


