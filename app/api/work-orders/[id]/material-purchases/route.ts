import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { canEmployeeViewWorkOrder, getWorkOrderById } from "@/lib/work-orders";
import {
  addMaterialPurchase,
  deleteMaterialPurchase,
  getMaterialPurchases,
} from "@/lib/material-purchases";
import { deleteFromS3, isS3Configured, uploadTaggedEntityFileToS3 } from "@/lib/s3";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

function parseCost(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);
    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }
    if (user.role === "employee" && !canEmployeeViewWorkOrder(user.id, workOrder)) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const purchases = await getMaterialPurchases("work_order", id);
    return Response.json({ purchases, s3Configured: isS3Configured() });
  } catch (error) {
    console.error("Error fetching work order material purchases:", error);
    return Response.json({ error: "Failed to fetch material purchases" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);
    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }
    if (user.role === "employee" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const formData = await request.formData();
    const storeName = typeof formData.get("store_name") === "string" ? (formData.get("store_name") as string).trim() : "";
    const totalCost = parseCost(formData.get("total_cost"));
    const file = formData.get("file");

    if (!storeName) {
      return Response.json({ error: "Store is required." }, { status: 400 });
    }
    if (totalCost === null) {
      return Response.json({ error: "A valid total cost is required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "A receipt photo is required." }, { status: 400 });
    }

    const uploadResult = await uploadTaggedEntityFileToS3(
      "work_order",
      id,
      "material-purchases",
      file.name,
      Buffer.from(await file.arrayBuffer()),
      file.type
    );

    if (!uploadResult.success || !uploadResult.key || !uploadResult.url) {
      const status = isS3Configured() ? 500 : 503;
      return Response.json(
        { error: uploadResult.error || "Failed to upload receipt photo to S3." },
        { status }
      );
    }

    const purchase = await addMaterialPurchase({
      entity_type: "work_order",
      entity_id: id,
      store_name: storeName,
      description:
        typeof formData.get("description") === "string"
          ? (formData.get("description") as string).trim() || null
          : null,
      total_cost: totalCost,
      receipt_filename: file.name,
      receipt_s3_key: uploadResult.key,
      receipt_s3_url: uploadResult.url,
      purchased_by: user.id,
    });

    return Response.json({ purchase, s3Configured: isS3Configured() }, { status: 201 });
  } catch (error) {
    console.error("Error creating work order material purchase:", error);
    return Response.json({ error: "Failed to save material purchase" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);
    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }
    if (user.role === "employee" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body.purchaseId !== "string" || !body.purchaseId.trim()) {
      return Response.json({ error: "Purchase ID is required." }, { status: 400 });
    }

    const deletedPurchase = await deleteMaterialPurchase(body.purchaseId);
    if (!deletedPurchase || deletedPurchase.entity_type !== "work_order" || deletedPurchase.entity_id !== id) {
      return Response.json({ error: "Material purchase not found." }, { status: 404 });
    }

    let deletedFromS3 = true;
    if (deletedPurchase.receipt_s3_key) {
      deletedFromS3 = await deleteFromS3(deletedPurchase.receipt_s3_key);
    }

    return Response.json({
      success: true,
      message: deletedFromS3
        ? "Material purchase deleted successfully."
        : "Material purchase deleted, but failed to delete the S3 receipt photo.",
    });
  } catch (error) {
    console.error("Error deleting work order material purchase:", error);
    return Response.json({ error: "Failed to delete material purchase" }, { status: 500 });
  }
}
