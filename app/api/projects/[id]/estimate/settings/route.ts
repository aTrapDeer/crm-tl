import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getProjectEstimateSettings,
  upsertProjectEstimateSettings,
} from "@/lib/projects";
import { parseInstallmentSchedule } from "@/lib/estimate";
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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can view estimate settings" }, { status: 403 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const settings = await getProjectEstimateSettings(id);
    return Response.json({ settings });
  } catch (error) {
    console.error("Error fetching estimate settings:", error);
    return Response.json({ error: "Failed to fetch estimate settings" }, { status: 500 });
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
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can update estimate settings" }, { status: 403 });
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Parameters<typeof upsertProjectEstimateSettings>[1] = {};

    if (body.markup_type !== undefined) {
      if (!["percentage", "fixed"].includes(body.markup_type)) {
        return Response.json({ error: "Invalid markup type" }, { status: 400 });
      }
      updateData.markup_type = body.markup_type;
    }

    if (body.markup_value !== undefined) {
      updateData.markup_value = parseFloat(body.markup_value) || 0;
    }

    if (body.tax_rate !== undefined) {
      updateData.tax_rate = parseFloat(body.tax_rate) || 0;
    }

    if (body.servicing_fee !== undefined) {
      updateData.servicing_fee = Boolean(body.servicing_fee);
    }

    if (body.installment_schedule !== undefined) {
      updateData.installment_schedule = parseInstallmentSchedule(body.installment_schedule);
    }

    if (body.custom_terms !== undefined) {
      updateData.custom_terms =
        typeof body.custom_terms === "string" && body.custom_terms.trim()
          ? body.custom_terms.trim()
          : null;
    }

    const settings = await upsertProjectEstimateSettings(id, updateData);
    return Response.json({ settings });
  } catch (error) {
    console.error("Error updating estimate settings:", error);
    return Response.json({ error: "Failed to update estimate settings" }, { status: 500 });
  }
}
