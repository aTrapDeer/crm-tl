import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  createBonanChangeRequest,
  getBonanChangeRequests,
  userHasBonanClientMembership,
  type BonanChangeRequestStatus,
  type BonanEntityType,
} from "@/lib/bonan-client";
import { getBonanReportById } from "@/lib/bonan-reports";
import { getIncidentReportById } from "@/lib/incident-reports";
import { getWorkOrderById } from "@/lib/work-orders";
import { sendNotificationEmail } from "@/lib/email";
import { turso } from "@/lib/turso";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

function parseEntityType(value: string | null): BonanEntityType | null {
  if (value === "bonan_report" || value === "work_order" || value === "incident_report") {
    return value;
  }
  return null;
}

function parseChangeRequestStatus(value: string | null): BonanChangeRequestStatus | undefined {
  if (
    value === "pending" ||
    value === "grant_approved" ||
    value === "changes_submitted" ||
    value === "applied" ||
    value === "rejected" ||
    value === "expired"
  ) {
    return value;
  }

  return undefined;
}

async function getAdminEmails() {
  const result = await turso.execute("SELECT email FROM users WHERE role = 'admin'");
  return result.rows.map((row) => row.email as string);
}

async function assertClientVisibleEntity(entityType: BonanEntityType, entityId: string) {
  if (entityType === "bonan_report") {
    const report = await getBonanReportById(entityId);
    return report && report.status === "submitted" ? report : null;
  }
  if (entityType === "work_order") {
    const workOrder = await getWorkOrderById(entityId);
    return workOrder && workOrder.site === "bonan_towers" && workOrder.publication_status === "published"
      ? workOrder
      : null;
  }
  const incident = await getIncidentReportById(entityId);
  return incident && incident.site === "bonan_towers" && incident.publication_status === "published"
    ? incident
    : null;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = parseEntityType(searchParams.get("entity_type"));
    const entityId = searchParams.get("entity_id");
    const status = parseChangeRequestStatus(searchParams.get("status"));

    if (user.role === "client") {
      if (!(await userHasBonanClientMembership(user.id))) {
        return Response.json({ error: "Bonan access denied" }, { status: 403 });
      }
      const changeRequests = await getBonanChangeRequests({
        requested_by: user.id,
        entity_type: entityType || undefined,
        entity_id: entityId || undefined,
        status,
      });
      return Response.json({ changeRequests });
    }

    if (user.role !== "admin") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const changeRequests = await getBonanChangeRequests({
      entity_type: entityType || undefined,
      entity_id: entityId || undefined,
      status,
    });
    return Response.json({ changeRequests });
  } catch (error) {
    console.error("Error fetching Bonan change requests:", error);
    return Response.json({ error: "Failed to fetch Bonan change requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can request corrections" }, { status: 403 });
    }
    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const entityType = parseEntityType(typeof body.entity_type === "string" ? body.entity_type : null);
    const entityId = typeof body.entity_id === "string" ? body.entity_id : "";
    const requestedArea = typeof body.requested_area === "string" ? body.requested_area.trim() : "";
    const rawRequestedFields: unknown[] = Array.isArray(body.requested_fields) ? body.requested_fields : [];
    const requestedFields = rawRequestedFields.filter(
      (entry: unknown): entry is string => typeof entry === "string" && entry.trim().length > 0
    );

    if (!entityType || !entityId || !requestedArea || requestedFields.length === 0) {
      return Response.json(
        { error: "entity_type, entity_id, requested_area, and requested_fields are required" },
        { status: 400 }
      );
    }

    const entity = await assertClientVisibleEntity(entityType, entityId);
    if (!entity) {
      return Response.json({ error: "That Bonan record is not available for correction requests" }, { status: 403 });
    }

    const changeRequest = await createBonanChangeRequest({
      entity_type: entityType,
      entity_id: entityId,
      requested_by: user.id,
      requested_area: requestedArea,
      requested_fields: requestedFields,
      message: typeof body.message === "string" ? body.message.trim() : null,
    });

    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendNotificationEmail({
        to: adminEmails,
        subject: "Bonan correction request submitted",
        title: "Bonan correction request",
        message: `${user.first_name} ${user.last_name} requested a scoped Bonan correction for ${entityType.replace("_", " ")} in ${requestedArea}.`,
      });
    }

    return Response.json({ changeRequest }, { status: 201 });
  } catch (error) {
    console.error("Error creating Bonan change request:", error);
    return Response.json({ error: "Failed to create Bonan change request" }, { status: 500 });
  }
}
