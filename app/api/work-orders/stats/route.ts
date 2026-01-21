import { getSession, getUserById } from "@/lib/auth";
import { getWorkOrderStats } from "@/lib/work-orders";
import { cookies } from "next/headers";

export async function GET() {
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

    // Only admin can view overall stats
    if (user.role !== "admin") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const stats = await getWorkOrderStats();

    return Response.json({ stats });
  } catch (error) {
    console.error("Error fetching work order stats:", error);
    return Response.json({ error: "Failed to fetch work order stats" }, { status: 500 });
  }
}
