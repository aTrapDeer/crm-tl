import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getBonanCollectiveSummary, getBonanReportById } from "@/lib/bonan-reports";
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const report = await getBonanReportById(id);
    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }
    if (user.role === "client") {
      if (!(await userHasBonanClientMembership(user.id))) {
        return Response.json({ error: "Bonan access denied" }, { status: 403 });
      }
      if (report.status !== "submitted") {
        return Response.json({ error: "Bonan report is not available to clients yet" }, { status: 403 });
      }
    }

    const summary = await getBonanCollectiveSummary(id);
    if (!summary) {
      return Response.json({ error: "Bonan report summary unavailable" }, { status: 404 });
    }

    return Response.json({ summary });
  } catch (error) {
    console.error("Error fetching Bonan collective summary:", error);
    return Response.json({ error: "Failed to fetch Bonan collective summary" }, { status: 500 });
  }
}
