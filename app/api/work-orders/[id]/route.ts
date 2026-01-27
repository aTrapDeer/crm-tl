import { getSession, getUserById } from "@/lib/auth";
import {
  getWorkOrderById,
  updateWorkOrder,
  deleteWorkOrder,
} from "@/lib/work-orders";
import { sendWorkOrderChangeNotification } from "@/lib/email";
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

    // Only admin and worker can access work orders
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Workers can only see work orders assigned to them
    if (user.role === "worker" && workOrder.assigned_to !== user.id) {
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

    // Only admin and worker can update work orders
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Workers can only update work orders assigned to them
    if (user.role === "worker" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    const previousStatus = workOrder.work_completed;

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
      work_completed: body.work_completed,
      completed_date: body.completed_date,
      completed_time: body.completed_time,
      work_summary: body.work_summary,
      project_id: body.project_id,
    });

    // Send email notification based on what changed
    if (updatedWorkOrder) {
      const newStatus = body.work_completed;

      if (newStatus === "completed" && previousStatus !== "completed") {
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
      } else if (newStatus && newStatus !== previousStatus) {
        // Status changed to something other than completed
        sendWorkOrderChangeNotification({
          workOrderId: id,
          workOrderNumber: updatedWorkOrder.work_order_number,
          action: "status_changed",
          newStatus: newStatus,
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
