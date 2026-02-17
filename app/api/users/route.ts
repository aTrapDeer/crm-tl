import { deleteUserById, getSession, getUserById } from "@/lib/auth";
import { getAllUsers } from "@/lib/projects";
import { turso } from "@/lib/turso";
import { cookies } from "next/headers";

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


