import { getSession, getUserById } from "@/lib/auth";
import {
  getEstimateLineItems,
  createEstimateLineItem,
  updateEstimateLineItem,
  deleteEstimateLineItem,
  getEstimateTotal,
  getProjectsByUserId,
  getProjectById,
  clearProjectSignatures,
  getActiveEstimateDelivery,
  getProjectEstimateSettings,
  getEstimateEvents,
} from "@/lib/projects";
import { calculateEstimateBreakdown, resolveClientVisibility } from "@/lib/estimate";
import { buildEstimateEngagementSummary } from "@/lib/estimate-engagement";
import { getTlCorpOrganization } from "@/lib/tl-corp-organization";
import { getEstimateClientDisplayForEmail } from "@/lib/crm-clients";
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

    if (user.role === "employee") {
      return Response.json(
        { error: "Employees cannot view project estimates" },
        { status: 403 }
      );
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    if (user.role === "client") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }

      const delivery = await getActiveEstimateDelivery(id);
      if (!delivery) {
        return Response.json(
          { error: "Estimate has not been sent yet", estimate_sent: false },
          { status: 403 }
        );
      }

      const clientVisibility = resolveClientVisibility(delivery.snapshot_settings, project);
      const organization = await getTlCorpOrganization();
      const hideClientLineItemPricing = clientVisibility.hide_line_item_prices_for_client;
      const visibleItems = hideClientLineItemPricing
        ? delivery.snapshot_line_items.map((item) => ({ ...item, price_rate: 0, total: 0 }))
        : delivery.snapshot_line_items;

      return Response.json({
        organization,
        items: visibleItems,
        total: delivery.snapshot_total,
        settings: delivery.snapshot_settings,
        delivery_id: delivery.id,
        tracking_token: delivery.tracking_token,
        sent_at: delivery.sent_at,
        estimate_sent: true,
        is_snapshot: true,
        hide_line_item_prices_for_client: hideClientLineItemPricing,
        hide_markup_for_client: clientVisibility.hide_markup_for_client,
      });
    }

    const [items, subtotal, settings, delivery, organization] = await Promise.all([
      getEstimateLineItems(id),
      getEstimateTotal(id),
      getProjectEstimateSettings(id),
      getActiveEstimateDelivery(id),
      getTlCorpOrganization(),
    ]);

    const breakdown = calculateEstimateBreakdown(subtotal, settings);

    const events = delivery ? await getEstimateEvents(delivery.id) : [];
    const engagement = delivery
      ? buildEstimateEngagementSummary(delivery, events)
      : null;
    const clientDisplay = delivery
      ? await getEstimateClientDisplayForEmail(delivery.sent_to_email)
      : null;

    return Response.json({
      organization,
      items,
      total: subtotal,
      breakdown,
      settings,
      delivery: delivery
        ? {
            id: delivery.id,
            sent_at: delivery.sent_at,
            sent_to_email: delivery.sent_to_email,
            email_opened_at: delivery.email_opened_at,
            first_viewed_at: delivery.first_viewed_at,
            recipient_name: delivery.recipient_name,
            snapshot_total: delivery.snapshot_total,
          }
        : null,
      engagement,
      client_display: clientDisplay,
      estimate_sent: Boolean(delivery),
      is_snapshot: false,
      hide_line_item_prices_for_client: project.hide_line_item_prices_for_client,
      hide_markup_for_client: project.hide_markup_for_client,
    });
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
    await clearProjectSignatures(id);

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
    await clearProjectSignatures(id);

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
    await clearProjectSignatures(id);

    return Response.json({ success: true, total });
  } catch (error) {
    console.error("Error deleting estimate item:", error);
    return Response.json({ error: "Failed to delete estimate item" }, { status: 500 });
  }
}
