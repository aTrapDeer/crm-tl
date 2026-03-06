import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getIncidentReportById } from "@/lib/incident-reports";
import { userHasBonanClientMembership } from "@/lib/bonan-client";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can view Bonan incidents" }, { status: 403 });
    }
    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const { id } = await params;
    const incidentReport = await getIncidentReportById(id);
    if (
      !incidentReport ||
      incidentReport.site !== "bonan_towers" ||
      incidentReport.publication_status !== "published"
    ) {
      return Response.json({ error: "Bonan incident report not found" }, { status: 404 });
    }

    return Response.json({ incidentReport });
  } catch (error) {
    console.error("Error fetching Bonan client incident report:", error);
    return Response.json({ error: "Failed to fetch Bonan incident report" }, { status: 500 });
  }
}
