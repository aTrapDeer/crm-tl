import { getCrmClientByInvitationToken } from "@/lib/crm-clients";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const client = await getCrmClientByInvitationToken(token);

    if (!client || client.invitation_status !== "pending") {
      return Response.json({ error: "Invite not found or inactive" }, { status: 404 });
    }

    if (
      client.invitation_expires_at &&
      new Date(client.invitation_expires_at) < new Date()
    ) {
      return Response.json({ error: "Invite has expired" }, { status: 410 });
    }

    return Response.json({
      email: client.email,
      full_name: client.full_name,
    });
  } catch (error) {
    console.error("Error validating client invite:", error);
    return Response.json({ error: "Failed to validate invite" }, { status: 500 });
  }
}
