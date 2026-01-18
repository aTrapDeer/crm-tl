import { getSession, getUserById } from "@/lib/auth";
import { getProjectUpdates, addProjectUpdate, getProjectsByUserId } from "@/lib/projects";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Non-admins can only view updates for assigned projects
    if (user.role !== "admin") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const updates = await getProjectUpdates(id);
    return Response.json({ updates });
  } catch (error) {
    console.error("Error fetching updates:", error);
    return Response.json({ error: "Failed to fetch updates" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only workers and admins can add updates
    if (user.role === "client") {
      return Response.json({ error: "Clients cannot add updates" }, { status: 403 });
    }

    // Workers can only add updates to assigned projects
    if (user.role === "worker") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    const update = await addProjectUpdate(id, user.id, title, content);
    return Response.json({ update });
  } catch (error) {
    console.error("Error adding update:", error);
    return Response.json({ error: "Failed to add update" }, { status: 500 });
  }
}

