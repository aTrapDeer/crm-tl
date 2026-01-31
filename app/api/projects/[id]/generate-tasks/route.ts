import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getEstimateLineItems,
  createProjectTask,
} from "@/lib/projects";
import { cookies } from "next/headers";
import OpenAI from "openai";

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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can generate tasks" }, { status: 403 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const estimateItems = await getEstimateLineItems(id);

    // Build context about the project
    const estimateDetails = estimateItems.map((item) => {
      const categoryName = item.category === "custom" ? item.custom_category_name : item.category;
      return `- ${categoryName}: ${item.description || "No description"} (Rate: $${item.price_rate}, Qty: ${item.quantity}, Total: $${item.total})`;
    }).join("\n");

    const prompt = `You are a construction project manager assistant. Based on the following project details, generate a realistic step-by-step task checklist that would be needed to complete this project. Only return tasks - no explanations or commentary.

Project Name: ${project.name}
Project Description: ${project.description || "No description provided"}
Project Address: ${project.address || "No address provided"}
Project Status: ${project.status}

Estimate Line Items:
${estimateDetails || "No estimate items yet"}

Generate a practical, ordered list of tasks for this construction/renovation project. Each task should be a clear, actionable step. Include preparation, execution, and cleanup/inspection steps where relevant. Return ONLY a JSON array of objects with "title" (short task name) and "description" (brief details about what this task involves). Keep it realistic and relevant to the line items above. Generate between 8-20 tasks depending on project complexity.

Response format (JSON array only, no markdown):
[{"title": "Task name", "description": "Brief description of what this involves"}]`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OpenAI API key not configured. Add OPENAI_API_KEY to your .env.local file." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2-2025-12-11",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      return Response.json({ error: "No response from AI" }, { status: 500 });
    }

    // Parse the JSON response - strip markdown code fences if present
    let tasks: { title: string; description: string }[];
    try {
      const cleaned = responseText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
      tasks = JSON.parse(cleaned);
    } catch {
      return Response.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return Response.json({ error: "AI returned no tasks. Please try again." }, { status: 500 });
    }

    // Create all tasks in the database
    const createdTasks = [];
    for (const task of tasks) {
      if (task.title && typeof task.title === "string") {
        const created = await createProjectTask({
          project_id: id,
          title: task.title.trim(),
          description: task.description?.trim() || undefined,
          created_by: user.id,
        });
        createdTasks.push(created);
      }
    }

    return Response.json({
      success: true,
      tasks: createdTasks,
      count: createdTasks.length,
    });
  } catch (error) {
    console.error("Error generating tasks:", error);
    return Response.json({ error: "Failed to generate tasks" }, { status: 500 });
  }
}
