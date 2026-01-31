import { getSession, getUserById } from "@/lib/auth";
import {
  getEstimateLineItems,
  createEstimateLineItem,
  updateEstimateLineItem,
  deleteEstimateLineItem,
  getEstimateTotal,
} from "@/lib/projects";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const items = await getEstimateLineItems(id);
    const total = await getEstimateTotal(id);

    return Response.json({ items, total });
  } catch (error) {
    console.error("Error fetching estimate:", error);
    return Response.json({ error: "Failed to fetch estimate" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can manage estimates" }, { status: 403 });
    }

    const body = await request.json();
    const { category, custom_category_name, description, price_rate, quantity } = body;

    if (!category) {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }

    const item = await createEstimateLineItem({
      project_id: id,
      category,
      custom_category_name: custom_category_name?.trim() || undefined,
      description: description?.trim() || undefined,
      price_rate: parseFloat(price_rate) || 0,
      quantity: parseFloat(quantity) || 1,
    });

    const total = await getEstimateTotal(id);

    return Response.json({ item, total });
  } catch (error) {
    console.error("Error creating estimate item:", error);
    return Response.json({ error: "Failed to create estimate item" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can manage estimates" }, { status: 403 });
    }

    const body = await request.json();
    const { itemId, category, custom_category_name, description, price_rate, quantity } = body;

    if (!itemId) {
      return Response.json({ error: "Item ID is required" }, { status: 400 });
    }

    const item = await updateEstimateLineItem(itemId, {
      category,
      custom_category_name: custom_category_name?.trim(),
      description: description?.trim(),
      price_rate: price_rate !== undefined ? parseFloat(price_rate) : undefined,
      quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    const total = await getEstimateTotal(id);

    return Response.json({ item, total });
  } catch (error) {
    console.error("Error updating estimate item:", error);
    return Response.json({ error: "Failed to update estimate item" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can manage estimates" }, { status: 403 });
    }

    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return Response.json({ error: "Item ID is required" }, { status: 400 });
    }

    await deleteEstimateLineItem(itemId);
    const total = await getEstimateTotal(id);

    return Response.json({ success: true, total });
  } catch (error) {
    console.error("Error deleting estimate item:", error);
    return Response.json({ error: "Failed to delete estimate item" }, { status: 500 });
  }
}
