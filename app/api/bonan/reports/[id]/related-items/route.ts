import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getBonanRelatedItems, getBonanReportById } from "@/lib/bonan-reports";
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

    const relatedItems = await getBonanRelatedItems(id);
    if (!relatedItems) {
      return Response.json({ error: "Related items unavailable" }, { status: 404 });
    }

    const clientSafeItems =
      user.role === "client"
        ? {
            ...relatedItems,
            incident_reports: relatedItems.incident_reports.filter(
              (incidentReport) => incidentReport.publication_status === "published"
            ),
            work_orders: relatedItems.work_orders.filter(
              (workOrder) => workOrder.publication_status === "published"
            ),
          }
        : relatedItems;

    return Response.json({ relatedItems: clientSafeItems });
  } catch (error) {
    console.error("Error fetching Bonan related items:", error);
    return Response.json({ error: "Failed to fetch related items" }, { status: 500 });
  }
}
