import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getIncidentReports, searchIncidentReports } from "@/lib/incident-reports";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const bonanReportId = searchParams.get("bonan_report_id");
    const publicationStatus = searchParams.get("publication_status");
    const statusesParam = searchParams.get("statuses");
    const site = searchParams.get("site");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const hasFilters = Boolean(bonanReportId || publicationStatus || statusesParam || site || dateFrom || dateTo);

    const incidentReports = hasFilters
      ? await searchIncidentReports({
          bonan_report_id: bonanReportId || undefined,
          statuses: statusesParam
            ? statusesParam
                .split(",")
                .map((value) => value.trim())
                .filter((value): value is "open" | "in_progress" | "closed" =>
                  value === "open" || value === "in_progress" || value === "closed"
                )
            : undefined,
          publication_status:
            publicationStatus === "draft" || publicationStatus === "published"
              ? publicationStatus
              : undefined,
          site: site === "bonan_towers" ? "bonan_towers" : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        })
      : await getIncidentReports();

    return Response.json({ incidentReports });
  } catch (error) {
    console.error("Error fetching incident reports:", error);
    return Response.json({ error: "Failed to fetch incident reports" }, { status: 500 });
  }
}
