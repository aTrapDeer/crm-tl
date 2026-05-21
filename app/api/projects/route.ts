import { getSession, getUserById } from "@/lib/auth";
import {
  getAllProjects,
  getProjectsByUserId,
  createProject,
  stripProjectPricingForEmployee,
  getActiveEstimateDelivery,
} from "@/lib/projects";
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
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects =
      user.role === "admin"
        ? await getAllProjects()
        : await getProjectsByUserId(user.id);

    if (user.role === "employee") {
      return Response.json({
        projects: projects.map(stripProjectPricingForEmployee),
      });
    }

    if (user.role === "client") {
      const projectsWithEstimate = await Promise.all(
        projects.map(async (project) => {
          const delivery = await getActiveEstimateDelivery(project.id);
          const { budget_amount, funding_notes, ...rest } = project;
          return {
            ...rest,
            budget_amount: delivery ? budget_amount : null,
            funding_notes: delivery ? funding_notes : null,
            estimate_sent: Boolean(delivery),
          };
        })
      );
      return Response.json({ projects: projectsWithEstimate });
    }

    return Response.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return Response.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
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
      return Response.json({ error: "Only admins can create projects" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      status,
      address,
      start_date,
      end_date,
      budget_amount,
      funding_notes,
    } = body;

    if (!name) {
      return Response.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await createProject({
      name,
      description,
      status,
      address,
      start_date,
      end_date,
      budget_amount,
      funding_notes,
    });

    return Response.json({ project });
  } catch (error) {
    console.error("Error creating project:", error);
    return Response.json({ error: "Failed to create project" }, { status: 500 });
  }
}


