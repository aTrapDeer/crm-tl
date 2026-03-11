import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { createBonanIsolatedWorkOrder } from "@/lib/bonan-management";

type WorkOrderPriority = "emergency" | "high" | "normal" | "low";
type WorkOrderServiceType =
  | "maintenance"
  | "repair"
  | "replace"
  | "inspection"
  | "preventive"
  | "cleaning"
  | "other";

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function isPriority(value: unknown): value is WorkOrderPriority {
  return value === "emergency" || value === "high" || value === "normal" || value === "low";
}

function isServiceType(value: unknown): value is WorkOrderServiceType {
  return (
    value === "maintenance" ||
    value === "repair" ||
    value === "replace" ||
    value === "inspection" ||
    value === "preventive" ||
    value === "cleaning" ||
    value === "other"
  );
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

    const workOrderResult = await createBonanIsolatedWorkOrder({
      report_date: reportDate,
      created_by: user.id,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      company: typeof body.company === "string" ? body.company : undefined,
      department: typeof body.department === "string" ? body.department : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      unit: typeof body.unit === "string" ? body.unit : undefined,
      area: typeof body.area === "string" ? body.area : undefined,
      access_needed: typeof body.access_needed === "string" ? body.access_needed : undefined,
      preferred_entry_time:
        typeof body.preferred_entry_time === "string" ? body.preferred_entry_time : undefined,
      priority: isPriority(body.priority) ? body.priority : undefined,
      service_type: isServiceType(body.service_type) ? body.service_type : undefined,
      description,
      assigned_to:
        user.role === "employee"
          ? user.id
          : typeof body.assigned_to === "string"
            ? body.assigned_to
            : undefined,
      scheduled_date:
        typeof body.scheduled_date === "string" && isValidIsoDate(body.scheduled_date)
          ? body.scheduled_date
          : undefined,
      scheduled_time: typeof body.scheduled_time === "string" ? body.scheduled_time : undefined,
      project_id: typeof body.project_id === "string" ? body.project_id : undefined,
    });

    return Response.json(
      {
        workOrder: workOrderResult.workOrder,
        anchorReport: {
          id: workOrderResult.anchorReport.id,
          report_type: workOrderResult.anchorReport.report_type,
          report_date: workOrderResult.anchorReport.report_date,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating Bonan isolated work order:", error);
    return Response.json({ error: "Failed to create Bonan work order." }, { status: 500 });
  }
}
