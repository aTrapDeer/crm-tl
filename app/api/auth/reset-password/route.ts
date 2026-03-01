import { deleteSessionsForUser, updateUserPassword } from "@/lib/auth";
import {
  getValidPasswordResetToken,
  invalidatePasswordResetTokensForUser,
  markPasswordResetTokenUsed,
} from "@/lib/password-resets";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") || "";

    if (!token) {
      return Response.json({ valid: false, error: "Token is required" }, { status: 400 });
    }

    const resetToken = await getValidPasswordResetToken(token);
    if (!resetToken) {
      return Response.json({ valid: false, error: "Invalid or expired token" }, { status: 400 });
    }

    return Response.json({ valid: true });
  } catch (error) {
    console.error("Reset token validation error:", error);
    return Response.json({ valid: false, error: "Failed to validate token" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!token || !newPassword) {
      return Response.json({ error: "Token and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const resetToken = await getValidPasswordResetToken(token);
    if (!resetToken) {
      return Response.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    await updateUserPassword(resetToken.user_id, newPassword);
    await markPasswordResetTokenUsed(resetToken.id);
    await invalidatePasswordResetTokensForUser(resetToken.user_id);
    await deleteSessionsForUser(resetToken.user_id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return Response.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
