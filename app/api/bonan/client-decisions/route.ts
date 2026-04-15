import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getIncidentReportById } from "@/lib/incident-reports";
import { getWorkOrderById } from "@/lib/work-orders";
import {
  getBonanClientDecisions,
  getBonanCurrentClientDecision,
  getBonanEntityRevision,
  saveBonanClientDecision,
  userHasBonanClientMembership,
  type BonanEntityType,
} from "@/lib/bonan-client";
import {
  isBonanClientVisibleIncidentReport,
  isBonanClientVisibleWorkOrder,
} from "@/lib/bonan-visibility";
import { sendBonanClientDecisionNotification } from "@/lib/email";

type DecisionEntityType = Extract<BonanEntityType, "work_order" | "incident_report">;

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

function parseEntityType(value: string | null): DecisionEntityType | null {
  if (value === "work_order" || value === "incident_report") {
    return value;
  }
  return null;
}

function parseDecisionStatus(value: string | null): "approved" | "denied" | null {
  if (value === "approved" || value === "denied") {
    return value;
  }
  return null;
}

async function assertEntityAccess(_userId: string, entityType: DecisionEntityType, entityId: string) {
  if (entityType === "work_order") {
    const workOrder = await getWorkOrderById(entityId);
    if (!workOrder || !isBonanClientVisibleWorkOrder(workOrder)) {
      return null;
    }
    return workOrder;
  }

  const incidentReport = await getIncidentReportById(entityId);
  if (!incidentReport || !isBonanClientVisibleIncidentReport(incidentReport)) {
    return null;
  }
  return incidentReport;
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

    if (!entityType || !entityId) {
      return Response.json({ error: "entity_type and entity_id are required" }, { status: 400 });
    }

    if (user.role === "client") {
      if (!(await userHasBonanClientMembership(user.id))) {
        return Response.json({ error: "Bonan access denied" }, { status: 403 });
      }
      const accessibleEntity = await assertEntityAccess(user.id, entityType, entityId);
      if (!accessibleEntity) {
        return Response.json({ error: "Entity is not available for client review" }, { status: 403 });
      }
    } else if (user.role !== "admin") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const [decisions, currentRevision] = await Promise.all([
      getBonanClientDecisions(entityType, entityId),
      getBonanEntityRevision(entityType, entityId),
    ]);
    const currentDecision = decisions.find((decision) => decision.entity_revision === currentRevision) || null;

    return Response.json({ decisions, currentDecision, currentRevision });
  } catch (error) {
    console.error("Error fetching Bonan client decisions:", error);
    return Response.json({ error: "Failed to fetch Bonan client decisions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can approve or deny items" }, { status: 403 });
    }

    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const entityType = parseEntityType(typeof body.entity_type === "string" ? body.entity_type : null);
    const entityId = typeof body.entity_id === "string" ? body.entity_id : "";
    const decisionStatus = parseDecisionStatus(
      typeof body.decision_status === "string" ? body.decision_status : null
    );

    if (!entityType || !entityId || !decisionStatus) {
      return Response.json(
        { error: "entity_type, entity_id, and decision_status are required" },
        { status: 400 }
      );
    }

    const accessibleEntity = await assertEntityAccess(user.id, entityType, entityId);
    if (!accessibleEntity) {
      return Response.json({ error: "Entity is not available for client review" }, { status: 403 });
    }

    const responderName =
      `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;

    const decision = await saveBonanClientDecision({
      entity_type: entityType,
      entity_id: entityId,
      decision_status: decisionStatus,
      responded_by_user_id: user.id,
      responder_name: responderName,
      response_date:
        typeof body.response_date === "string" && body.response_date.trim()
          ? body.response_date.trim()
          : new Date().toISOString().slice(0, 10),
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    });

    const entityLabel =
      entityType === "work_order"
        ? `Work Order #${String("work_order_number" in accessibleEntity ? accessibleEntity.work_order_number : entityId)}`
        : `Incident Report #${String("report_number" in accessibleEntity ? accessibleEntity.report_number : entityId)}`;

    sendBonanClientDecisionNotification({
      entityType,
      entityId,
      entityLabel,
      decisionStatus,
      responderName,
      responseDate: decision.response_date,
      note: decision.note,
    }).catch(console.error);

    const currentDecision = await getBonanCurrentClientDecision(entityType, entityId, decision.entity_revision);
    return Response.json({ decision: currentDecision ?? decision }, { status: 201 });
  } catch (error) {
    console.error("Error creating Bonan client decision:", error);
    return Response.json({ error: "Failed to create Bonan client decision" }, { status: 500 });
  }
}
