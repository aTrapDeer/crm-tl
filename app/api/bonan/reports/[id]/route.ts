import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { deleteBonanReport, getBonanReportById, updateBonanReport } from "@/lib/bonan-reports";
import { sendNotificationEmail } from "@/lib/email";
import { turso } from "@/lib/turso";
import type { BonanReportStatus, DailyReportPayload } from "@/lib/bonan-types";

function isValidReportStatus(value: string): value is BonanReportStatus {
  return value === "draft" || value === "submitted";
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  return user;
}

async function getSubmissionRecipientEmails(reportId: string): Promise<string[]> {
  const adminResult = await turso.execute("SELECT email FROM users WHERE role = 'admin'");
  const creatorResult = await turso.execute({
    sql: `SELECT u.email
          FROM users u
          INNER JOIN bonan_reports br ON br.created_by = u.id
          WHERE br.id = ?`,
    args: [reportId],
  });
  const linkedWorkOrderResult = await turso.execute({
    sql: `SELECT DISTINCT u.email
          FROM users u
          INNER JOIN bonan_reports br ON br.id = ?
          INNER JOIN work_orders wo ON wo.id = br.work_order_id
          WHERE u.id = wo.created_by OR u.id = wo.assigned_to`,
    args: [reportId],
  });

  const emails = [
    ...adminResult.rows.map((row) => row.email as string),
    ...creatorResult.rows.map((row) => row.email as string),
    ...linkedWorkOrderResult.rows.map((row) => row.email as string),
  ];

  return [...new Set(emails.filter(Boolean))];
}

async function sendDailySubmissionNotification(report: Awaited<ReturnType<typeof getBonanReportById>>) {
  if (!report || report.report_type !== "daily") return;

  const recipients = await getSubmissionRecipientEmails(report.id);
  if (recipients.length === 0) return;

  const payload = report.payload as DailyReportPayload;
  const inspector = payload.metadata.inspector || "Unspecified inspector";
  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  await sendNotificationEmail({
    to: recipients,
    subject: `[Bonan Daily Submitted] ${report.report_date} (${report.work_order_number || "No WO"})`,
    title: "Bonan Towers Daily Walk-Through Submitted",
    message: `A daily Bonan Towers walk-through was submitted by ${inspector} for ${report.report_date}.`,
    actionUrl: `${appUrl}/dashboard/bonan/daily/${report.id}`,
    actionLabel: "View Daily Report",
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const report = await getBonanReportById(id);
    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    return Response.json({ report });
  } catch (error) {
    console.error("Error fetching Bonan report:", error);
    return Response.json({ error: "Failed to fetch Bonan report" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await getBonanReportById(id);
    if (!existing) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const nextStatus = body.status;

    if (nextStatus !== undefined) {
      if (typeof nextStatus !== "string" || !isValidReportStatus(nextStatus)) {
        return Response.json({ error: "Invalid report status" }, { status: 400 });
      }
    }

    const report = await updateBonanReport(id, {
      payload: body.payload,
      status: nextStatus,
    });

    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    if (existing.status !== "submitted" && report.status === "submitted") {
      sendDailySubmissionNotification(report).catch((error) => {
        console.error("Failed to send Bonan daily submission notification:", error);
      });
    }

    return Response.json({ report });
  } catch (error) {
    console.error("Error updating Bonan report:", error);
    return Response.json({ error: "Failed to update Bonan report" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can delete Bonan reports." }, { status: 403 });
    }

    const { id } = await params;
    const deleted = await deleteBonanReport(id);
    if (!deleted) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting Bonan report:", error);
    return Response.json({ error: "Failed to delete Bonan report" }, { status: 500 });
  }
}
