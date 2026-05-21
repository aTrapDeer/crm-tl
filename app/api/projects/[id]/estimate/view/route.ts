import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getProjectsByUserId,
  getActiveEstimateDelivery,
  getEstimateDeliveryByToken,
  markEstimateViewedInApp,
} from "@/lib/projects";
import {
  sendEstimateViewedNotification,
} from "@/lib/email";
import { cookies } from "next/headers";

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

    if (user.role === "employee") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    if (user.role === "client") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const deliveryToken = body.delivery_token as string | undefined;

    const delivery = deliveryToken
      ? await getEstimateDeliveryByToken(deliveryToken)
      : await getActiveEstimateDelivery(id);

    if (!delivery || delivery.project_id !== id || delivery.status !== "sent") {
      return Response.json({ error: "No active estimate delivery found" }, { status: 404 });
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent");

    if (user.role !== "client") {
      return Response.json({ success: true, is_first_view: false });
    }

    const { isFirstView } = await markEstimateViewedInApp({
      deliveryId: delivery.id,
      userId: user.id,
      userEmail: user.email,
      ipAddress,
      userAgent,
      channel: "portal",
    });

    if (isFirstView) {
      sendEstimateViewedNotification({
        projectId: id,
        projectName: project.name,
        viewerName: `${user.first_name} ${user.last_name}`,
        viewerEmail: user.email,
        viewerRole: user.role,
      }).catch(console.error);
    }

    return Response.json({ success: true, is_first_view: isFirstView });
  } catch (error) {
    console.error("Error recording estimate view:", error);
    return Response.json({ error: "Failed to record view" }, { status: 500 });
  }
}
