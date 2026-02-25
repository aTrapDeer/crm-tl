import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getIncidentReports } from "@/lib/incident-reports";

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

    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const incidentReports = await getIncidentReports();
    return Response.json({ incidentReports });
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    return Response.json({ error: "Failed to fetch incident reports" }, { status: 500 });
  }
}
