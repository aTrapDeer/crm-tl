import { getSession, getUserById } from "@/lib/auth";
import { getProjectById, updateProject, getProjectsByUserId } from "@/lib/projects";
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

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Non-admins can only view assigned projects
    if (user.role !== "admin") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    return Response.json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return Response.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(
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

    // Employees can update assigned projects, admins can update any
    if (user.role === "client") {
      return Response.json({ error: "Clients cannot update projects" }, { status: 403 });
    }

    if (user.role === "employee") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();

    // Validate on_hold status requires a reason
    if (body.status === "on_hold" && !body.on_hold_reason) {
      return Response.json(
        { error: "A reason is required when putting a project on hold" },
        { status: 400 }
      );
    }

    // Clear on_hold fields when status changes from on_hold
    const currentProject = await getProjectById(id);
    if (
      currentProject &&
      currentProject.status === "on_hold" &&
      body.status &&
      body.status !== "on_hold"
    ) {
      body.on_hold_reason = null;
      body.expected_resume_date = null;
    }

    const project = await updateProject(id, body);

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    return Response.json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return Response.json({ error: "Failed to update project" }, { status: 500 });
  }
}

