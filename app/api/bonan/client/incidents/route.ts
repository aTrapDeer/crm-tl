import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { searchIncidentReports } from "@/lib/incident-reports";
import { userHasBonanClientMembership } from "@/lib/bonan-client";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can view Bonan incidents" }, { status: 403 });
    }
    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const incidentReports = await searchIncidentReports({
      site: "bonan_towers",
      publication_status: "published",
    });
    return Response.json({ incidentReports });
  } catch (error) {
    console.error("Error fetching Bonan client incidents:", error);
    return Response.json({ error: "Failed to fetch Bonan incidents" }, { status: 500 });
  }
}
