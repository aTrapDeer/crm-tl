import { getSession, getUserById } from "@/lib/auth";
import {
  getWorkOrderById,
  getWorkOrderInvitations,
  createWorkOrderInvitation,
  deleteWorkOrderInvitation,
} from "@/lib/work-orders";
import { sendWorkOrderInvitationEmail } from "@/lib/email";
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

    // Only admin and worker can view invitations
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const workOrder = await getWorkOrderById(id);
    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Workers can only see invitations for work orders assigned to them
    if (user.role === "worker" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const invitations = await getWorkOrderInvitations(id);

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

    // Only admin and worker can invite customers
    if (user.role === "client") {
      return Response.json(
        { error: "Clients cannot invite customers" },
        { status: 403 }
      );
    }

    const workOrder = await getWorkOrderById(id);
    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Workers can only invite for work orders assigned to them
    if (user.role === "worker" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { customer_name, email } = body;

    if (!customer_name || typeof customer_name !== "string" || !customer_name.trim()) {
      return Response.json({ error: "Customer name is required" }, { status: 400 });
    }

    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    const invitation = await createWorkOrderInvitation({
      work_order_id: id,
      customer_name: customer_name.trim(),
      email: email.trim().toLowerCase(),
      invited_by: user.id,
    });

    // Send the invitation email
    await sendWorkOrderInvitationEmail({
      to: email.trim().toLowerCase(),
      customerName: customer_name.trim(),
      inviterName: `${user.first_name} ${user.last_name}`,
      inviteToken: invitation.token,
      workOrderNumber: workOrder.work_order_number,
      company: workOrder.company || undefined,
      location: workOrder.location || undefined,
      description: workOrder.description,
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

export async function DELETE(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Only admin can delete invitations
    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can delete invitations" }, { status: 403 });
    }

    const body = await request.json();
    const { invitation_id } = body;

    if (!invitation_id) {
      return Response.json({ error: "Invitation ID is required" }, { status: 400 });
    }

    await deleteWorkOrderInvitation(invitation_id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting invitation:", error);
    return Response.json(
      { error: "Failed to delete invitation" },
      { status: 500 }
    );
  }
}
