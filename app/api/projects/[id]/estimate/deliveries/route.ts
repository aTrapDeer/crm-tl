import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getEstimateDeliveries,
  getEstimateEvents,
} from "@/lib/projects";
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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can view delivery history" }, { status: 403 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const deliveries = await getEstimateDeliveries(id);
    const deliveriesWithEvents = await Promise.all(
      deliveries.map(async (delivery) => ({
        ...delivery,
        snapshot_line_items: undefined,
        snapshot_settings: undefined,
        events: await getEstimateEvents(delivery.id),
      }))
    );

    return Response.json({ deliveries: deliveriesWithEvents });
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    return Response.json({ error: "Failed to fetch deliveries" }, { status: 500 });
  }
}
