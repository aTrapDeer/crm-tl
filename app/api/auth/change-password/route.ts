import {
  getSession,
  getUserByIdWithPassword,
  updateUserPassword,
  verifyPassword,
} from "@/lib/auth";
import { cookies } from "next/headers";

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

    const body = await request.json().catch(() => ({}));
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return Response.json(
        { error: "New password must be different from the current password" },
        { status: 400 }
      );
    }

    const user = await getUserByIdWithPassword(session.user_id);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validCurrentPassword = await verifyPassword(
      currentPassword,
      user.password_hash
    );
    if (!validCurrentPassword) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    await updateUserPassword(user.id, newPassword);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return Response.json({ error: "Failed to change password" }, { status: 500 });
  }
}
