import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  getBonanChangeRequestById,
  submitBonanChangeRequestEdits,
  userHasBonanClientMembership,
} from "@/lib/bonan-client";
import { sendNotificationEmail } from "@/lib/email";
import { turso } from "@/lib/turso";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

async function getAdminEmails() {
  const result = await turso.execute("SELECT email FROM users WHERE role = 'admin'");
  return result.rows.map((row) => row.email as string);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can submit approved corrections" }, { status: 403 });
    }
    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const { id } = await params;
    const changeRequest = await getBonanChangeRequestById(id);
    if (!changeRequest) {
      return Response.json({ error: "Bonan change request not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rawEdits: unknown[] = Array.isArray(body.edits) ? body.edits : [];
    const edits = rawEdits.filter(
      (entry: unknown): entry is { field_path: string; old_value?: string | null; proposed_value?: string | null } =>
        typeof entry === "object" &&
        entry !== null &&
        "field_path" in entry &&
        typeof entry.field_path === "string" &&
        entry.field_path.trim().length > 0
    );

    if (edits.length === 0) {
      return Response.json({ error: "At least one edit is required" }, { status: 400 });
    }

    const invalidField = edits.find((edit) => !changeRequest.approved_fields.includes(edit.field_path));
    if (invalidField) {
      return Response.json({ error: `Field ${invalidField.field_path} is not approved for editing` }, { status: 400 });
    }

    const updated = await submitBonanChangeRequestEdits({
      change_request_id: id,
      requester_id: user.id,
      edits,
    });

    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendNotificationEmail({
        to: adminEmails,
        subject: "Bonan approved corrections submitted",
        title: "Bonan corrections submitted",
        message: `${user.first_name} ${user.last_name} submitted approved Bonan corrections for review.`,
      });
    }

    return Response.json({ changeRequest: updated });
  } catch (error) {
    console.error("Error submitting Bonan change request edits:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to submit Bonan change request edits" },
      { status: 500 }
    );
  }
}
