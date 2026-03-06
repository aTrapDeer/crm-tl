import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  finalizeBonanChangeRequest,
  getBonanChangeRequestById,
  getBonanChangeRequestEdits,
  grantBonanChangeRequest,
  rejectBonanChangeRequest,
} from "@/lib/bonan-client";
import { getBonanReportById, updateBonanReport } from "@/lib/bonan-reports";
import type { IncidentReport } from "@/lib/incident-reports";
import { getIncidentReportById, updateIncidentReport } from "@/lib/incident-reports";
import type { WorkOrder } from "@/lib/work-orders";
import { getWorkOrderById, updateWorkOrder } from "@/lib/work-orders";
import { sendNotificationEmail } from "@/lib/email";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

function setDeepValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) return;

  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    const current = cursor[key];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

function normalizeEditValue(value: string | null) {
  if (value === null) return "";
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  if (value !== "" && Number.isFinite(numeric) && String(numeric) === value) {
    return numeric;
  }
  return value;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can review Bonan change requests" }, { status: 403 });
    }

    const { id } = await params;
    const changeRequest = await getBonanChangeRequestById(id);
    if (!changeRequest) {
      return Response.json({ error: "Bonan change request not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "grant") {
      const rawApprovedFields: unknown[] = Array.isArray(body.approved_fields) ? body.approved_fields : [];
      const approvedFields = rawApprovedFields.filter(
        (entry: unknown): entry is string => typeof entry === "string" && entry.trim().length > 0
      );
      if (approvedFields.length === 0) {
        return Response.json({ error: "approved_fields are required" }, { status: 400 });
      }
      const granted = await grantBonanChangeRequest(id, {
        approved_fields: approvedFields,
        grant_expires_at:
          typeof body.grant_expires_at === "string" && body.grant_expires_at.trim()
            ? body.grant_expires_at
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        admin_notes: typeof body.admin_notes === "string" ? body.admin_notes.trim() : null,
        granted_by: user.id,
      });
      if (granted?.requester_email) {
        await sendNotificationEmail({
          to: granted.requester_email,
          subject: "Bonan correction request approved",
          title: "Correction request approved",
          message: `Your Bonan correction request was approved for ${granted.requested_area}. You can now submit the approved field corrections.`,
        });
      }
      return Response.json({ changeRequest: granted });
    }

    if (action === "reject") {
      const rejected = await rejectBonanChangeRequest(id, {
        admin_notes: typeof body.admin_notes === "string" ? body.admin_notes.trim() : null,
        reviewer_id: user.id,
      });
      if (rejected?.requester_email) {
        await sendNotificationEmail({
          to: rejected.requester_email,
          subject: "Bonan correction request rejected",
          title: "Correction request rejected",
          message: rejected.admin_notes || "Your Bonan correction request was not approved.",
        });
      }
      return Response.json({ changeRequest: rejected });
    }

    if (action !== "apply") {
      return Response.json({ error: "Valid action is required" }, { status: 400 });
    }

    if (changeRequest.status !== "changes_submitted") {
      return Response.json({ error: "No submitted Bonan corrections are waiting to be applied" }, { status: 409 });
    }

    const edits = await getBonanChangeRequestEdits(id);
    if (edits.length === 0) {
      return Response.json({ error: "No submitted edits were found" }, { status: 400 });
    }

    if (changeRequest.entity_type === "bonan_report") {
      const report = await getBonanReportById(changeRequest.entity_id);
      if (!report) {
        return Response.json({ error: "Bonan report not found" }, { status: 404 });
      }
      const nextPayload =
        report.payload && typeof report.payload === "object" && !Array.isArray(report.payload)
          ? JSON.parse(JSON.stringify(report.payload))
          : {};
      for (const edit of edits) {
        if (!changeRequest.approved_fields.includes(edit.field_path)) {
          continue;
        }
        setDeepValue(nextPayload as Record<string, unknown>, edit.field_path, normalizeEditValue(edit.proposed_value));
      }
      await updateBonanReport(report.id, { payload: nextPayload });
    } else if (changeRequest.entity_type === "work_order") {
      const workOrder = await getWorkOrderById(changeRequest.entity_id);
      if (!workOrder) {
        return Response.json({ error: "Work order not found" }, { status: 404 });
      }
      const patch: Record<string, unknown> = {};
      for (const edit of edits) {
        if (changeRequest.approved_fields.includes(edit.field_path)) {
          patch[edit.field_path] = normalizeEditValue(edit.proposed_value);
        }
      }
      await updateWorkOrder(workOrder.id, patch as Partial<Omit<WorkOrder, "id" | "work_order_number" | "created_at" | "created_by">>);
    } else {
      const incidentReport = await getIncidentReportById(changeRequest.entity_id);
      if (!incidentReport) {
        return Response.json({ error: "Incident report not found" }, { status: 404 });
      }
      const patch: Record<string, unknown> = {};
      for (const edit of edits) {
        if (changeRequest.approved_fields.includes(edit.field_path)) {
          patch[edit.field_path] = normalizeEditValue(edit.proposed_value);
        }
      }
      await updateIncidentReport(
        incidentReport.id,
        patch as Partial<Omit<IncidentReport, "id" | "bonan_report_id" | "report_number" | "created_by" | "created_at" | "updated_at">>
      );
    }

    const applied = await finalizeBonanChangeRequest({
      id,
      status: "applied",
      reviewer_id: user.id,
      admin_notes: typeof body.admin_notes === "string" ? body.admin_notes.trim() : null,
    });

    if (applied?.requester_email) {
      await sendNotificationEmail({
        to: applied.requester_email,
        subject: "Bonan correction applied",
        title: "Correction applied",
        message: "Your approved Bonan corrections were applied to the live record.",
      });
    }

    return Response.json({ changeRequest: applied });
  } catch (error) {
    console.error("Error reviewing Bonan change request:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to review Bonan change request" },
      { status: 500 }
    );
  }
}
