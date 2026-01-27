import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  getProjectsByUserId,
  getProjectTaskStats,
  getProjectById,
} from "@/lib/projects";
import { sendTaskChangeNotification } from "@/lib/email";
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

    // Non-admins can only view assigned projects
    if (user.role !== "admin") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const tasks = await getProjectTasks(id);
    const stats = await getProjectTaskStats(id);
    
    return Response.json({ tasks, stats });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return Response.json({ error: "Failed to fetch tasks" }, { status: 500 });
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

    // Clients cannot create tasks
    if (user.role === "client") {
      return Response.json({ error: "Clients cannot create tasks" }, { status: 403 });
    }

    // Workers can only add tasks to assigned projects
    if (user.role === "worker") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return Response.json({ error: "Task title is required" }, { status: 400 });
    }

    const task = await createProjectTask({
      project_id: id,
      title: title.trim(),
      description: description?.trim() || undefined,
      created_by: user.id,
    });

    // Send email notification to admins
    const project = await getProjectById(id);
    if (project) {
      sendTaskChangeNotification({
        projectId: id,
        projectName: project.name,
        taskTitle: task.title,
        action: "created",
        performedBy: `${user.first_name} ${user.last_name}`,
      }).catch(console.error);
    }

    return Response.json({ task });
  } catch (error) {
    console.error("Error creating task:", error);
    return Response.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
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

    // Clients cannot update tasks
    if (user.role === "client") {
      return Response.json({ error: "Clients cannot update tasks" }, { status: 403 });
    }

    // Workers can only update tasks on assigned projects
    if (user.role === "worker") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === projectId);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { taskId, title, description, is_completed } = body;

    if (!taskId) {
      return Response.json({ error: "Task ID is required" }, { status: 400 });
    }

    const task = await updateProjectTask(
      taskId,
      {
        title: title?.trim(),
        description: description?.trim(),
        is_completed,
      },
      user.id
    );

    if (!task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    // Send email notification if task was completed
    if (is_completed === true) {
      const project = await getProjectById(projectId);
      if (project) {
        sendTaskChangeNotification({
          projectId: projectId,
          projectName: project.name,
          taskTitle: task.title,
          action: "completed",
          performedBy: `${user.first_name} ${user.last_name}`,
        }).catch(console.error);
      }
    }

    const stats = await getProjectTaskStats(projectId);
    return Response.json({ task, stats });
  } catch (error) {
    console.error("Error updating task:", error);
    return Response.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
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

    // Only admins can delete tasks
    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can delete tasks" }, { status: 403 });
    }

    const body = await request.json();
    const { taskId, taskTitle } = body;

    if (!taskId) {
      return Response.json({ error: "Task ID is required" }, { status: 400 });
    }

    await deleteProjectTask(taskId);

    // Send email notification for task deletion
    if (taskTitle) {
      const project = await getProjectById(projectId);
      if (project) {
        sendTaskChangeNotification({
          projectId: projectId,
          projectName: project.name,
          taskTitle: taskTitle,
          action: "deleted",
          performedBy: `${user.first_name} ${user.last_name}`,
        }).catch(console.error);
      }
    }

    const stats = await getProjectTaskStats(projectId);
    return Response.json({ success: true, stats });
  } catch (error) {
    console.error("Error deleting task:", error);
    return Response.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

