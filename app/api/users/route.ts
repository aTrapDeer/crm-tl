import { deleteUserById, getSession, getUserById, hashPassword } from "@/lib/auth";
import { getAllUsers } from "@/lib/projects";
import { sendUserPasswordResetEmail } from "@/lib/email";
import { turso } from "@/lib/turso";
import { cookies } from "next/headers";

const USER_ROLES = ["admin", "employee", "client"] as const;

type UserRole = (typeof USER_ROLES)[number];

export async function GET() {
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
      return Response.json({ error: "Only admins can view all users" }, { status: 403 });
    }

    const users = await getAllUsers();
    return Response.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
      return Response.json({ error: "Only admins can delete users" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    if (userId === user.id) {
      return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "admin") {
      const adminCountResult = await turso.execute(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      const adminCount = Number(adminCountResult.rows[0]?.count || 0);
      if (adminCount <= 1) {
        return Response.json({ error: "Cannot delete the last admin user" }, { status: 400 });
      }
    }

    const deleted = await deleteUserById(userId);
    if (!deleted) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
      return Response.json({ error: "Only admins can update users" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "update-role") {
      const requestedRole = typeof body.role === "string" ? body.role.trim() : "";
      const nextRole = USER_ROLES.find((role) => role === requestedRole) as UserRole | undefined;

      if (!nextRole) {
        return Response.json({ error: "Valid role is required" }, { status: 400 });
      }

      if (targetUser.id === user.id && targetUser.role !== nextRole) {
        return Response.json({ error: "You cannot change your own role" }, { status: 400 });
      }

      if (targetUser.role === "admin" && nextRole !== "admin") {
        const adminCountResult = await turso.execute(
          "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
        );
        const adminCount = Number(adminCountResult.rows[0]?.count || 0);
        if (adminCount <= 1) {
          return Response.json({ error: "Cannot demote the last admin user" }, { status: 400 });
        }
      }

      await turso.execute({
        sql: "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?",
        args: [nextRole, targetUser.id],
      });

      const updatedUser = await getUserById(targetUser.id);
      return Response.json({ success: true, user: updatedUser });
    }

    if (action === "send-password-reset") {
      const tempPassword = `TL-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      const passwordHash = await hashPassword(tempPassword);

      await turso.execute({
        sql: "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
        args: [passwordHash, targetUser.id],
      });

      const sent = await sendUserPasswordResetEmail({
        to: targetUser.email,
        fullName: `${targetUser.first_name} ${targetUser.last_name}`.trim(),
        temporaryPassword: tempPassword,
      });

      if (!sent) {
        return Response.json(
          {
            error: "Password reset was generated, but email could not be sent.",
          },
          { status: 500 }
        );
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating user:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}


