import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  createAssociatedWorkOrderForBonanReport,
  getBonanAssociatedWorkOrders,
  getBonanReportById,
} from "@/lib/bonan-reports";

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

    const associatedWorkOrders = await getBonanAssociatedWorkOrders(id);
    return Response.json({ associatedWorkOrders });
  } catch (error) {
    console.error("Error fetching associated Bonan work orders:", error);
    return Response.json({ error: "Failed to fetch associated work orders" }, { status: 500 });
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
    const assignedTo =
      user.role === "employee"
        ? user.id
        : typeof body.assigned_to === "string"
          ? body.assigned_to
          : null;

    const associatedWorkOrder = await createAssociatedWorkOrderForBonanReport({
      report_id: id,
      created_by: user.id,
      assigned_to: assignedTo,
      description: typeof body.description === "string" ? body.description : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      area: typeof body.area === "string" ? body.area : undefined,
      priority:
        body.priority === "emergency" ||
        body.priority === "high" ||
        body.priority === "normal" ||
        body.priority === "low"
          ? body.priority
          : undefined,
      service_type:
        body.service_type === "maintenance" ||
        body.service_type === "repair" ||
        body.service_type === "replace" ||
        body.service_type === "inspection" ||
        body.service_type === "preventive" ||
        body.service_type === "cleaning" ||
        body.service_type === "other"
          ? body.service_type
          : undefined,
    });

    if (!associatedWorkOrder) {
      return Response.json({ error: "Failed to create associated work order" }, { status: 500 });
    }

    return Response.json({ associatedWorkOrder }, { status: 201 });
  } catch (error) {
    console.error("Error creating associated Bonan work order:", error);
    return Response.json({ error: "Failed to create associated work order" }, { status: 500 });
  }
}
