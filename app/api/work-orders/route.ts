import { getSession, getUserById } from "@/lib/auth";
import {
  getAllWorkOrders,
  getWorkOrdersByAssignee,
  createWorkOrder,
  generateWorkOrderNumber,
  searchWorkOrders,
  type WorkOrderFilters,
} from "@/lib/work-orders";
import { sendWorkOrderChangeNotification } from "@/lib/email";
import { cookies } from "next/headers";

export async function GET(request: Request) {
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

    // Check for filter parameters
    const { searchParams } = new URL(request.url);
    const filters: WorkOrderFilters = {};

    if (searchParams.get("status")) {
      filters.status = searchParams.get("status") as WorkOrderFilters["status"];
    }
    if (searchParams.get("priority")) {
      filters.priority = searchParams.get("priority") as WorkOrderFilters["priority"];
    }
    if (searchParams.get("service_type")) {
      filters.service_type = searchParams.get("service_type") as WorkOrderFilters["service_type"];
    }
    if (searchParams.get("assigned_to")) {
      filters.assigned_to = searchParams.get("assigned_to")!;
    }
    if (searchParams.get("project_id")) {
      filters.project_id = searchParams.get("project_id")!;
    }
    if (searchParams.get("date_from")) {
      filters.date_from = searchParams.get("date_from")!;
    }
    if (searchParams.get("date_to")) {
      filters.date_to = searchParams.get("date_to")!;
    }
    if (searchParams.get("search")) {
      filters.search = searchParams.get("search")!;
    }

    // Worker can only see their assigned work orders
    if (user.role === "worker") {
      filters.assigned_to = user.id;
    }

    // If filters provided, use search function
    const hasFilters = Object.keys(filters).length > 0;
    const workOrders = hasFilters
      ? await searchWorkOrders(filters)
      : user.role === "admin"
        ? await getAllWorkOrders()
        : await getWorkOrdersByAssignee(user.id);

    return Response.json({ workOrders });
  } catch (error) {
    console.error("Error fetching work orders:", error);
    return Response.json({ error: "Failed to fetch work orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    // Only admin and worker can create work orders
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    // Generate work order number if not provided
    const workOrderNumber = body.work_order_number || (await generateWorkOrderNumber());

    if (!body.description) {
      return Response.json({ error: "Description is required" }, { status: 400 });
    }

    const workOrder = await createWorkOrder({
      work_order_number: workOrderNumber,
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
      project_id: body.project_id,
      created_by: user.id,
    });

    // Send email notification to admins
    sendWorkOrderChangeNotification({
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.work_order_number,
      action: "created",
      description: workOrder.description,
      performedBy: `${user.first_name} ${user.last_name}`,
      company: workOrder.company || undefined,
      location: workOrder.location || undefined,
    }).catch(console.error);

    return Response.json({ workOrder });
  } catch (error) {
    console.error("Error creating work order:", error);
    return Response.json({ error: "Failed to create work order" }, { status: 500 });
  }
}
