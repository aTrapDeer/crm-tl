import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { canEmployeeViewWorkOrder, getWorkOrderById } from "@/lib/work-orders";
import {
  addEntityPhoto,
  deleteEntityPhoto,
  getEntityPhotos,
  type EntityPhotoRole,
} from "@/lib/entity-photos";
import { deleteFromS3, isS3Configured, uploadEntityFileToS3 } from "@/lib/s3";

function parsePhotoRole(value: FormDataEntryValue | null): EntityPhotoRole {
  return value === "before" || value === "after" || value === "general"
    ? value
    : "general";
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
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

    const photos = await getEntityPhotos("work_order", id);
    return Response.json({ photos, s3Configured: isS3Configured() });
  } catch (error) {
    console.error("Error fetching work order photos:", error);
    return Response.json({ error: "Failed to fetch work order photos" }, { status: 500 });
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
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const uploadResult = await uploadEntityFileToS3(
      "work_order",
      id,
      file.name,
      Buffer.from(await file.arrayBuffer()),
      file.type
    );

    if (!uploadResult.success || !uploadResult.key || !uploadResult.url) {
      const status = isS3Configured() ? 500 : 503;
      return Response.json(
        { error: uploadResult.error || "Failed to upload photo to S3" },
        { status }
      );
    }

    const photo = await addEntityPhoto({
      entity_type: "work_order",
      entity_id: id,
      photo_role: parsePhotoRole(formData.get("photo_role")),
      filename: file.name,
      s3_key: uploadResult.key,
      s3_url: uploadResult.url,
      caption:
        typeof formData.get("caption") === "string"
          ? (formData.get("caption") as string).trim() || null
          : null,
      uploaded_by: user.id,
    });

    return Response.json({ photo, s3Configured: isS3Configured() }, { status: 201 });
  } catch (error) {
    console.error("Error uploading work order photo:", error);
    return Response.json({ error: "Failed to upload work order photo" }, { status: 500 });
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
    if (typeof body.photoId !== "string" || !body.photoId.trim()) {
      return Response.json({ error: "Photo ID is required" }, { status: 400 });
    }

    const deletedPhoto = await deleteEntityPhoto(body.photoId);
    if (!deletedPhoto) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }

    let deletedFromS3 = true;
    if (deletedPhoto.s3_key) {
      deletedFromS3 = await deleteFromS3(deletedPhoto.s3_key);
    }

    return Response.json({
      success: true,
      message: deletedFromS3
        ? "Photo deleted successfully"
        : "Photo record deleted, but failed to delete object from S3",
    });
  } catch (error) {
    console.error("Error deleting work order photo:", error);
    return Response.json({ error: "Failed to delete work order photo" }, { status: 500 });
  }
}
