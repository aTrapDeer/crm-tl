import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getEstimateLineItems,
  getEstimateTotal,
  getProjectEstimateSettings,
  createEstimateDelivery,
  getProjectEstimateRecipients,
  getPendingInvitationForEmail,
  updateProject,
  clearProjectSignatures,
} from "@/lib/projects";
import {
  calculateEstimateBreakdown,
  calculateInstallmentAmounts,
  formatCurrency,
} from "@/lib/estimate";
import {
  sendProjectEstimateEmail,
} from "@/lib/email";
import { cookies } from "next/headers";

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
      return Response.json({ error: "Only admins can send estimates" }, { status: 403 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { recipient_user_id, recipient_email } = body;

    const [lineItems, subtotal, settings, recipients] = await Promise.all([
      getEstimateLineItems(id),
      getEstimateTotal(id),
      getProjectEstimateSettings(id),
      getProjectEstimateRecipients(id),
    ]);

    if (lineItems.length === 0) {
      return Response.json({ error: "Add at least one line item before sending" }, { status: 400 });
    }

    let targetEmail = recipient_email?.trim()?.toLowerCase();
    let targetUserId: string | null = null;
    let clientName = "Valued Client";
    let inviteToken: string | undefined;

    if (recipient_user_id) {
      const recipient = recipients.find((r) => r.id === recipient_user_id);
      if (!recipient) {
        return Response.json({ error: "Selected recipient not found for this project" }, { status: 400 });
      }
      targetEmail = recipient.email.toLowerCase();
      targetUserId = recipient.id;
      clientName = recipient.name;
      inviteToken = recipient.invitation_token;
    } else if (targetEmail) {
      const recipient = recipients.find((r) => r.email.toLowerCase() === targetEmail);
      if (recipient) {
        targetUserId = recipient.id;
        clientName = recipient.name;
        inviteToken = recipient.invitation_token;
      }
    }

    if (!targetEmail) {
      if (recipients.length === 0) {
        return Response.json(
          { error: "No clients or pending invitations on this project. Invite a client first." },
          { status: 400 }
        );
      }
      if (recipients.length === 1) {
        targetEmail = recipients[0].email.toLowerCase();
        targetUserId = recipients[0].id;
        clientName = recipients[0].name;
        inviteToken = recipients[0].invitation_token;
      } else {
        return Response.json(
          { error: "Multiple recipients available. Select a recipient or provide recipient_email." },
          { status: 400 }
        );
      }
    }

    if (!inviteToken) {
      const pendingInvite = await getPendingInvitationForEmail(id, targetEmail);
      inviteToken = pendingInvite?.token;
    }

    const breakdown = calculateEstimateBreakdown(subtotal, settings);
    const installments = calculateInstallmentAmounts(breakdown.total, settings.installment_schedule);

    const snapshotSettings = {
      ...settings,
      hide_line_item_prices_for_client: project.hide_line_item_prices_for_client,
      hide_markup_for_client: project.hide_markup_for_client,
    };

    const delivery = await createEstimateDelivery({
      project_id: id,
      sent_by: user.id,
      sent_to_email: targetEmail,
      recipient_user_id: targetUserId,
      snapshot_line_items: lineItems,
      snapshot_settings: snapshotSettings,
      snapshot_total: breakdown.total,
    });

    await updateProject(id, {
      budget_amount: breakdown.total,
      funding_notes: `Estimate Total: ${formatCurrency(breakdown.total)}`,
    });
    await clearProjectSignatures(id);

    const emailSent = await sendProjectEstimateEmail({
      to: targetEmail,
      projectName: project.name,
      clientName,
      grandTotal: breakdown.total,
      subtotal,
      breakdown,
      lineItems,
      installments,
      deliveryToken: delivery.tracking_token,
      projectId: id,
      inviteToken,
      hideLineItemPricing: project.hide_line_item_prices_for_client,
      hideMarkup: project.hide_markup_for_client,
    });

    return Response.json({
      success: true,
      delivery: {
        id: delivery.id,
        sent_at: delivery.sent_at,
        sent_to_email: delivery.sent_to_email,
        snapshot_total: delivery.snapshot_total,
        tracking_token: delivery.tracking_token,
      },
      email_sent: emailSent,
      recipients,
    });
  } catch (error) {
    console.error("Error sending estimate:", error);
    return Response.json({ error: "Failed to send estimate" }, { status: 500 });
  }
}

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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can view send options" }, { status: 403 });
    }

    const recipients = await getProjectEstimateRecipients(id);
    return Response.json({ recipients, clients: recipients });
  } catch (error) {
    console.error("Error fetching send options:", error);
    return Response.json({ error: "Failed to fetch send options" }, { status: 500 });
  }
}
