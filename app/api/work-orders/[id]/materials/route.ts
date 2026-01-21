import { getSession, getUserById } from "@/lib/auth";
import {
  getWorkOrderById,
  getWorkOrderMaterials,
  addWorkOrderMaterial,
  deleteWorkOrderMaterial,
} from "@/lib/work-orders";
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

    // Only admin and worker can access work order materials
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Workers can only see materials for work orders assigned to them
    if (user.role === "worker" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const materials = await getWorkOrderMaterials(id);

    return Response.json({ materials });
  } catch (error) {
    console.error("Error fetching materials:", error);
    return Response.json({ error: "Failed to fetch materials" }, { status: 500 });
  }
}

export async function POST(
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

    // Only admin and worker can add materials
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Workers can only add materials to work orders assigned to them
    if (user.role === "worker" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.material_name) {
      return Response.json({ error: "Material name is required" }, { status: 400 });
    }

    const material = await addWorkOrderMaterial({
      work_order_id: id,
      material_name: body.material_name,
      quantity: body.quantity,
      unit: body.unit,
      unit_cost: body.unit_cost,
      notes: body.notes,
    });

    return Response.json({ material });
  } catch (error) {
    console.error("Error adding material:", error);
    return Response.json({ error: "Failed to add material" }, { status: 500 });
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

    // Only admin and worker can delete materials
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Workers can only delete materials from work orders assigned to them
    if (user.role === "worker" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.material_id) {
      return Response.json({ error: "Material ID is required" }, { status: 400 });
    }

    await deleteWorkOrderMaterial(body.material_id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting material:", error);
    return Response.json({ error: "Failed to delete material" }, { status: 500 });
  }
}
