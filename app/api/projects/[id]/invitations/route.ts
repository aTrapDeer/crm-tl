import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getProjectsByUserId,
  createProjectInvitation,
  getProjectInvitations,
} from "@/lib/projects";
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

    // Only admins and workers can view invitations
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    // Workers can only view for assigned projects
    if (user.role === "worker") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
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

    // Only admins and workers can invite clients
    if (user.role === "client") {
      return Response.json(
        { error: "Clients cannot invite other users" },
        { status: 403 }
      );
    }

    // Workers can only invite for assigned projects
    if (user.role === "worker") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    const invitation = await createProjectInvitation({
      project_id: id,
      email,
      invited_by: user.id,
    });

    // Send the invitation email (will be a no-op until Resend is configured)
    await sendInvitationEmail({
      to: email,
      projectName: project.name,
      inviterName: `${user.first_name} ${user.last_name}`,
      inviteToken: invitation.token,
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
