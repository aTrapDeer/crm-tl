import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  getIncidentReportById,
  updateIncidentReport,
  type IncidentReportStatus,
} from "@/lib/incident-reports";
import { sendIncidentReportStatusNotification } from "@/lib/email";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const incidentReport = await getIncidentReportById(id);
    if (!incidentReport) {
      return Response.json({ error: "Incident report not found" }, { status: 404 });
    }

    return Response.json({ incidentReport });
  } catch (error) {
    console.error("Error fetching incident report:", error);
    return Response.json({ error: "Failed to fetch incident report" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const existing = await getIncidentReportById(id);
    if (!existing) {
      return Response.json({ error: "Incident report not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (existing.publication_status === "published") {
      const publishedEditableFields = new Set(["status", "status_note"]);
      const hasDisallowedPublishedEdit = Object.keys(body).some((key) => !publishedEditableFields.has(key));
      if (hasDisallowedPublishedEdit) {
        return Response.json(
          { error: "Published incident reports only allow status updates and close-out notes." },
          { status: 409 }
        );
      }
    }
    const status =
      body.status === "open" || body.status === "in_progress" || body.status === "closed"
        ? (body.status as IncidentReportStatus)
        : undefined;
    const statusNoteProvided = Object.prototype.hasOwnProperty.call(body, "status_note");
    const statusNote =
      user.role === "admin" && statusNoteProvided
        ? typeof body.status_note === "string"
          ? body.status_note.trim() || null
          : body.status_note === null
            ? null
            : existing.status_note
        : undefined;
    const shouldUpdateStatusAudit =
      (status !== undefined && status !== existing.status) ||
      (user.role === "admin" && statusNoteProvided);
    const publicationStatus =
      body.publication_status === "draft" || body.publication_status === "published"
        ? body.publication_status
        : undefined;
    const publishedAt =
      publicationStatus === "published"
        ? existing.published_at || new Date().toISOString()
        : undefined;

    const incidentReport = await updateIncidentReport(id, {
      report_date: typeof body.report_date === "string" ? body.report_date : undefined,
      section_name: typeof body.section_name === "string" ? body.section_name : undefined,
      incident_time: typeof body.incident_time === "string" ? body.incident_time : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      system_area: typeof body.system_area === "string" ? body.system_area : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      actions_taken: typeof body.actions_taken === "string" ? body.actions_taken : undefined,
      work_order_or_vendor:
        typeof body.work_order_or_vendor === "string" ? body.work_order_or_vendor : undefined,
      status,
      status_note: statusNote,
      status_updated_at: shouldUpdateStatusAudit ? new Date().toISOString() : undefined,
      status_updated_by: shouldUpdateStatusAudit ? user.id : undefined,
      publication_status: publicationStatus,
      published_at: publishedAt,
    });

    if (incidentReport && status && status !== existing.status) {
      sendIncidentReportStatusNotification({
        incidentReportId: incidentReport.id,
        reportNumber: incidentReport.report_number,
        sectionName: incidentReport.section_name,
        newStatus: status,
        description: incidentReport.description,
        performedBy: `${user.first_name} ${user.last_name}`,
        location: incidentReport.location || undefined,
      }).catch(console.error);
    }

    return Response.json({ incidentReport });
  } catch (error) {
    console.error("Error updating incident report:", error);
    return Response.json({ error: "Failed to update incident report" }, { status: 500 });
  }
}
