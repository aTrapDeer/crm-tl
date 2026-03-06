import { cookies, headers } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getBonanReportById } from "@/lib/bonan-reports";
import { getIncidentReportById } from "@/lib/incident-reports";
import { getWorkOrderById } from "@/lib/work-orders";
import {
  getBonanApprovals,
  getBonanEntityRevision,
  saveBonanApproval,
  userHasBonanClientMembership,
  type BonanEntityType,
} from "@/lib/bonan-client";
import { sendNotificationEmail } from "@/lib/email";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

async function assertEntityAccess(userId: string, entityType: BonanEntityType, entityId: string) {
  if (entityType === "bonan_report") {
    const report = await getBonanReportById(entityId);
    if (!report || report.status !== "submitted") return null;
    return report;
  }

  if (entityType === "work_order") {
    const workOrder = await getWorkOrderById(entityId);
    if (!workOrder || workOrder.site !== "bonan_towers" || workOrder.publication_status !== "published") {
      return null;
    }
    return workOrder;
  }

  const incidentReport = await getIncidentReportById(entityId);
  if (
    !incidentReport ||
    incidentReport.site !== "bonan_towers" ||
    incidentReport.publication_status !== "published"
  ) {
    return null;
  }
  return incidentReport;
}

function parseEntityType(value: string | null): BonanEntityType | null {
  if (value === "bonan_report" || value === "work_order" || value === "incident_report") {
    return value;
  }
  return null;
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
    }

    const approvals = await getBonanApprovals(entityType, entityId);
    const currentRevision = await getBonanEntityRevision(entityType, entityId);
    return Response.json({ approvals, currentRevision });
  } catch (error) {
    console.error("Error fetching Bonan approvals:", error);
    return Response.json({ error: "Failed to fetch Bonan approvals" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can approve items" }, { status: 403 });
    }

    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const entityType = parseEntityType(typeof body.entity_type === "string" ? body.entity_type : null);
    const entityId = typeof body.entity_id === "string" ? body.entity_id : "";
    if (!entityType || !entityId) {
      return Response.json({ error: "entity_type and entity_id are required" }, { status: 400 });
    }

    const accessibleEntity = await assertEntityAccess(user.id, entityType, entityId);
    if (!accessibleEntity) {
      return Response.json({ error: "Entity is not available for client review" }, { status: 403 });
    }

    if (typeof body.signer_name !== "string" || !body.signer_name.trim()) {
      return Response.json({ error: "Signer name is required" }, { status: 400 });
    }
    if (typeof body.signature_data !== "string" || !body.signature_data.trim()) {
      return Response.json({ error: "Signature is required" }, { status: 400 });
    }

    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      null;

    const approval = await saveBonanApproval({
      entity_type: entityType,
      entity_id: entityId,
      approved_by_user_id: user.id,
      signer_name: body.signer_name.trim(),
      signature_data: body.signature_data,
      approval_date:
        typeof body.approval_date === "string" && body.approval_date.trim()
          ? body.approval_date
          : new Date().toISOString().slice(0, 10),
      ip_address: ipAddress,
    });

    await sendNotificationEmail({
      to: user.email,
      subject: "Bonan approval recorded",
      title: "Approval recorded",
      message: `Your Bonan approval for ${entityType.replace("_", " ")} was recorded for ${approval.approval_date}.`,
    });

    return Response.json({ approval }, { status: 201 });
  } catch (error) {
    console.error("Error creating Bonan approval:", error);
    return Response.json({ error: "Failed to create Bonan approval" }, { status: 500 });
  }
}
