import { getUserByEmail } from "@/lib/auth";
import { sendPasswordResetLinkEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-resets";

const APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "http://localhost:3000"
).replace(/\/+$/, "");

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (user) {
      try {
        const token = await createPasswordResetToken(user.id);
        const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
        const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
        await sendPasswordResetLinkEmail({
          to: user.email,
          fullName,
          resetUrl,
        });
      } catch (error) {
        console.error("Failed to prepare forgot-password email:", error);
      }
    }

    return Response.json({
      success: true,
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return Response.json({ error: "Failed to process request" }, { status: 500 });
  }
}
