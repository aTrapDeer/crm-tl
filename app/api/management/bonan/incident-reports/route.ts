import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { createBonanIsolatedIncidentReport } from "@/lib/bonan-management";

type IncidentStatus = "open" | "in_progress" | "closed";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function isIncidentStatus(value: unknown): value is IncidentStatus {
  return value === "open" || value === "in_progress" || value === "closed";
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const reportDate = typeof body.report_date === "string" ? body.report_date : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!isValidIsoDate(reportDate)) {
      return Response.json({ error: "Invalid report_date. Use YYYY-MM-DD." }, { status: 400 });
    }
    if (!description) {
      return Response.json({ error: "Description is required." }, { status: 400 });
    }

    const incidentResult = await createBonanIsolatedIncidentReport({
      report_date: reportDate,
      created_by: user.id,
      section_name: typeof body.section_name === "string" ? body.section_name : undefined,
      incident_time: typeof body.incident_time === "string" ? body.incident_time : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      system_area: typeof body.system_area === "string" ? body.system_area : undefined,
      description,
      actions_taken: typeof body.actions_taken === "string" ? body.actions_taken : undefined,
      work_order_or_vendor:
        typeof body.work_order_or_vendor === "string" ? body.work_order_or_vendor : undefined,
      status: isIncidentStatus(body.status) ? body.status : undefined,
    });

    return Response.json(
      {
        incidentReport: incidentResult.incidentReport,
        anchorReport: {
          id: incidentResult.anchorReport.id,
          report_type: incidentResult.anchorReport.report_type,
          report_date: incidentResult.anchorReport.report_date,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating Bonan isolated incident report:", error);
    return Response.json({ error: "Failed to create Bonan incident report." }, { status: 500 });
  }
}
