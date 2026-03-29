import { getSession, getUserById } from "@/lib/auth";
import {
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
  canEmployeeViewWorkOrder,
} from "@/lib/work-orders";
import { sendWorkOrderChangeNotification } from "@/lib/email";
import { getUsCentralDate, getUsCentralTimeHHMM } from "@/lib/us-central-time";
import { cookies } from "next/headers";

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

    // Only admin and employee can access work orders
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Employees can view assigned work orders and any work order already in progress.
    if (user.role === "employee" && !canEmployeeViewWorkOrder(user.id, workOrder)) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    return Response.json({ workOrder });
  } catch (error) {
    console.error("Error fetching work order:", error);
    return Response.json({ error: "Failed to fetch work order" }, { status: 500 });
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

    // Only admin and employee can update work orders
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    if (user.role === "employee" && Object.prototype.hasOwnProperty.call(body, "assigned_to")) {
      const raw = body.assigned_to;
      const normalized =
        raw === "" || raw === null || raw === undefined ? null : String(raw);
      if (normalized !== null && normalized !== user.id) {
        return Response.json(
          { error: "Employees cannot assign work orders to another user." },
          { status: 403 }
        );
      }
    }
    const requestedPublicationStatus =
      body.publication_status === "draft" || body.publication_status === "published"
        ? body.publication_status
        : undefined;

    if (requestedPublicationStatus === "published" && user.role !== "admin") {
      return Response.json(
        { error: "Only admins can publish work orders." },
        { status: 403 }
      );
    }

    if (requestedPublicationStatus === "draft") {
      return Response.json(
        { error: "Published work orders cannot be reverted to draft." },
        { status: 400 }
      );
    }

    const previousStatus = workOrder.work_completed;
    const nextStatus =
      body.work_completed === "pending" ||
      body.work_completed === "in_progress" ||
      body.work_completed === "completed" ||
      body.work_completed === "cancelled"
        ? body.work_completed
        : undefined;
    if (user.role === "employee" && nextStatus === "in_progress" && previousStatus !== "in_progress") {
      return Response.json(
        { error: "Employees cannot move a work order into In Progress." },
        { status: 403 }
      );
    }
    const statusNoteProvided = Object.prototype.hasOwnProperty.call(body, "status_note");
    const statusNote =
      user.role === "admin" && statusNoteProvided
        ? typeof body.status_note === "string"
          ? body.status_note.trim() || null
          : body.status_note === null
            ? null
            : workOrder.status_note
        : undefined;
    const statusChanged = nextStatus !== undefined && nextStatus !== previousStatus;
    const shouldUpdateStatusAudit = statusChanged || (user.role === "admin" && statusNoteProvided);
    const publishedAt =
      requestedPublicationStatus === "published"
        ? workOrder.published_at || new Date().toISOString()
        : undefined;
    let completedDate =
      typeof body.completed_date === "string"
        ? body.completed_date
        : body.completed_date === null
          ? null
          : undefined;
    let completedTime =
      typeof body.completed_time === "string"
        ? body.completed_time
        : body.completed_time === null
          ? null
          : undefined;

    if (statusChanged && nextStatus === "completed") {
      if (completedDate === undefined) completedDate = getUsCentralDate();
      if (completedTime === undefined) completedTime = getUsCentralTimeHHMM();
    }
    if (statusChanged && nextStatus !== "completed") {
      if (completedDate === undefined) completedDate = null;
      if (completedTime === undefined) completedTime = null;
    }

    const updatedWorkOrder = await updateWorkOrder(id, {
      date: body.date,
      time_received: body.time_received,
      phone: body.phone,
      email: body.email,
      company: body.company,
      department: body.department,
      location: body.location,
      unit: body.unit,
      area: body.area,
      access_needed: body.access_needed,
      preferred_entry_time: body.preferred_entry_time,
      priority: body.priority,
      service_type: body.service_type,
      description: body.description,
      assigned_to: body.assigned_to,
      scheduled_date: body.scheduled_date,
      scheduled_time: body.scheduled_time,
      time_in: body.time_in,
      time_out: body.time_out,
      total_labor_hours: body.total_labor_hours,
      work_completed: nextStatus,
      completed_date: completedDate,
      completed_time: completedTime,
      work_summary: body.work_summary,
      status_note: statusNote,
      status_updated_at: shouldUpdateStatusAudit ? new Date().toISOString() : undefined,
      status_updated_by: shouldUpdateStatusAudit ? user.id : undefined,
      project_id: body.project_id,
      publication_status: requestedPublicationStatus,
      published_at: publishedAt,
    });

    // Send email notification based on what changed
    if (updatedWorkOrder) {
      if (nextStatus === "completed" && previousStatus !== "completed") {
        // Work order was marked as completed
        sendWorkOrderChangeNotification({
          workOrderId: id,
          workOrderNumber: updatedWorkOrder.work_order_number,
          action: "completed",
          description: updatedWorkOrder.description,
          performedBy: `${user.first_name} ${user.last_name}`,
          company: updatedWorkOrder.company || undefined,
          location: updatedWorkOrder.location || undefined,
        }).catch(console.error);
      }
    }

    return Response.json({ workOrder: updatedWorkOrder });
  } catch (error) {
    console.error("Error updating work order:", error);
    return Response.json({ error: "Failed to update work order" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Only admin can delete work orders
    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can delete work orders" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }
    await deleteWorkOrder(id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting work order:", error);
    return Response.json({ error: "Failed to delete work order" }, { status: 500 });
  }
}
