import {
  getEstimateDeliveryByToken,
  getProjectById,
  markEstimateViewedInApp,
} from "@/lib/projects";
import { sendEstimateViewedNotification } from "@/lib/email";
import { resolveClientVisibility } from "@/lib/estimate";
import { getTlCorpOrganization } from "@/lib/tl-corp-organization";
import { getEstimateClientDisplayForEmail } from "@/lib/crm-clients";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const delivery = await getEstimateDeliveryByToken(token);

    if (!delivery || delivery.status !== "sent") {
      return Response.json({ error: "Estimate not found" }, { status: 404 });
    }

    const project = await getProjectById(delivery.project_id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const clientVisibility = resolveClientVisibility(delivery.snapshot_settings, project);
    const organization = await getTlCorpOrganization();
    const clientDisplay = await getEstimateClientDisplayForEmail(delivery.sent_to_email);

    return Response.json({
      organization,
      project: {
        id: project.id,
        name: project.name,
        address: project.address,
      },
      client_display: {
        ...clientDisplay,
        clientName: delivery.recipient_name || clientDisplay.clientName,
      },
      delivery: {
        id: delivery.id,
        sent_at: delivery.sent_at,
        sent_to_email: delivery.sent_to_email,
        snapshot_total: delivery.snapshot_total,
        snapshot_line_items: delivery.snapshot_line_items,
        snapshot_settings: delivery.snapshot_settings,
        recipient_name: delivery.recipient_name,
        hide_line_item_prices_for_client: clientVisibility.hide_line_item_prices_for_client,
        hide_markup_for_client: clientVisibility.hide_markup_for_client,
      },
    });
  } catch (error) {
    console.error("Error fetching public estimate:", error);
    return Response.json({ error: "Failed to load estimate" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const delivery = await getEstimateDeliveryByToken(token);

    if (!delivery || delivery.status !== "sent") {
      return Response.json({ error: "Estimate not found" }, { status: 404 });
    }

    const project = await getProjectById(delivery.project_id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent");

    const { isFirstView } = await markEstimateViewedInApp({
      deliveryId: delivery.id,
      userEmail: delivery.sent_to_email,
      ipAddress,
      userAgent,
      channel: "public_link",
    });

    if (isFirstView) {
      sendEstimateViewedNotification({
        projectId: delivery.project_id,
        projectName: project.name,
        viewerName: delivery.recipient_name || delivery.sent_to_email,
        viewerEmail: delivery.sent_to_email,
        viewerRole: "client (email link)",
      }).catch(console.error);
    }

    return Response.json({ success: true, is_first_view: isFirstView });
  } catch (error) {
    console.error("Error recording public estimate view:", error);
    return Response.json({ error: "Failed to record view" }, { status: 500 });
  }
}
