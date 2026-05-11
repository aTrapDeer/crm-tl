import { getSession, getUserById } from "@/lib/auth";
import { sendNotificationEmail } from "@/lib/email";
import { cookies } from "next/headers";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can send test emails" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const to = typeof body.to === "string" ? body.to.trim() : "";

    if (!to || !isValidEmail(to)) {
      return Response.json({ error: "Enter a valid recipient email address." }, { status: 400 });
    }

    const sentAt = new Date();
    const adminName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    const message = [
      "This is a test email from the TL-Corp CRM admin test portal.",
      `Sent by: ${adminName} (${user.email})`,
      `Sent at: ${sentAt.toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: "America/Chicago",
      })} CT`,
      "If you received this email, the SES email service is running correctly.",
    ].join("<br />");

    const ok = await sendNotificationEmail({
      to,
      subject: "TL-Corp CRM Email Service Test",
      title: "Email Service Test",
      message,
    });

    if (!ok) {
      return Response.json({ error: "Failed to send test email." }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error sending test email:", error);
    return Response.json({ error: "Failed to send test email." }, { status: 500 });
  }
}
