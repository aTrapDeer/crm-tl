import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getBonanReportById } from "@/lib/bonan-reports";
import {
  createIncidentReport,
  getIncidentReportsForBonanReport,
} from "@/lib/incident-reports";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  return user;
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
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const report = await getBonanReportById(id);
    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    const associatedIncidentReports = await getIncidentReportsForBonanReport(id);
    return Response.json({ associatedIncidentReports });
  } catch (error) {
    console.error("Error fetching associated incident reports:", error);
    return Response.json({ error: "Failed to fetch associated incident reports" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const report = await getBonanReportById(id);
    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const sectionKey = typeof body.section_key === "string" ? body.section_key.trim() : "";
    const sectionName = typeof body.section_name === "string" ? body.section_name.trim() : "General Incident";

    const associatedIncidentReports = await getIncidentReportsForBonanReport(id);
    const existingAssociatedIncidentReport = associatedIncidentReports.find((incidentReport) => {
      const existingSectionKey = (incidentReport.section_key || "").trim().toLowerCase();
      const existingSectionName = (incidentReport.section_name || "").trim().toLowerCase();
      if (sectionKey) {
        return existingSectionKey === sectionKey.toLowerCase();
      }
      return existingSectionName === sectionName.toLowerCase();
    });

    if (existingAssociatedIncidentReport) {
      const duplicateMessage = sectionName
        ? `An incident report for ${sectionName} already exists for ${report.report_date}.`
        : `An incident report already exists for ${report.report_date}.`;
      return Response.json(
        {
          error: duplicateMessage,
          existingAssociatedIncidentReport,
        },
        { status: 409 }
      );
    }

    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : `${sectionName} - Incident identified during daily walkthrough (${report.report_date}).`;

    const associatedIncidentReport = await createIncidentReport({
      bonan_report_id: id,
      report_date: report.report_date,
      section_key: sectionKey || undefined,
      section_name: sectionName,
      incident_time: typeof body.incident_time === "string" ? body.incident_time : undefined,
      location: typeof body.location === "string" ? body.location : "Bonan Towers",
      system_area: typeof body.system_area === "string" ? body.system_area : undefined,
      description,
      actions_taken: typeof body.actions_taken === "string" ? body.actions_taken : undefined,
      work_order_or_vendor:
        typeof body.work_order_or_vendor === "string" ? body.work_order_or_vendor : undefined,
      created_by: user.id,
    });

    return Response.json({ associatedIncidentReport }, { status: 201 });
  } catch (error) {
    console.error("Error creating associated incident report:", error);
    return Response.json({ error: "Failed to create associated incident report" }, { status: 500 });
  }
}
