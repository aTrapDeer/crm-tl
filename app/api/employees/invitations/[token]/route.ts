import { getEmployeeInvitationByToken } from "@/lib/employees";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invitation = await getEmployeeInvitationByToken(token);

    if (!invitation) {
      return Response.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "pending") {
      return Response.json({ error: "Invitation is no longer active" }, { status: 400 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return Response.json({ error: "Invitation has expired" }, { status: 400 });
    }

    return Response.json({
      invitation: {
        email: invitation.email,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        expires_at: invitation.expires_at,
        inviter_name: invitation.inviter_name || null,
      },
    });
  } catch (error) {
    console.error("Error validating employee invitation:", error);
    return Response.json(
      { error: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}
