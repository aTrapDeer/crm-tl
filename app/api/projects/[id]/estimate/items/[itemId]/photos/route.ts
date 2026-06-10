import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getProjectById } from "@/lib/projects";
import {
  addEntityPhoto,
  deleteEntityPhoto,
  getEntityPhotoById,
  getEntityPhotos,
  type EntityPhotoRole,
} from "@/lib/entity-photos";
import { deleteFromS3, isS3Configured, uploadEntityFileToS3 } from "@/lib/s3";

function parsePhotoRole(value: FormDataEntryValue | null): EntityPhotoRole {
  return value === "before" || value === "after" ? value : "general";
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const user = await requireAdmin();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const project = await getProjectById(id);
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    const photos = await getEntityPhotos("estimate_line_item", itemId);
    return Response.json({ photos, s3Configured: isS3Configured() });
  } catch (error) {
    console.error("Error fetching estimate item photos:", error);
    return Response.json({ error: "Failed to fetch photos" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const user = await requireAdmin();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const project = await getProjectById(id);
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Photo file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadEntityFileToS3(
      "project",
      id,
      file.name || "line-item-photo",
      buffer,
      file.type || "application/octet-stream"
    );

    if (!uploadResult.success || !uploadResult.key || !uploadResult.url) {
      return Response.json(
        { error: uploadResult.error || "Failed to upload photo to S3" },
        { status: 500 }
      );
    }

    const photo = await addEntityPhoto({
      entity_type: "estimate_line_item",
      entity_id: itemId,
      photo_role: parsePhotoRole(formData.get("photo_role")),
      filename: file.name || "line-item-photo",
      s3_key: uploadResult.key,
      s3_url: uploadResult.url,
      caption: typeof formData.get("caption") === "string" ? String(formData.get("caption")).trim() : null,
      uploaded_by: user.id,
    });

    return Response.json({ photo });
  } catch (error) {
    console.error("Error uploading estimate item photo:", error);
    return Response.json({ error: "Failed to upload photo" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const user = await requireAdmin();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const photoId = typeof body.photoId === "string" ? body.photoId : "";
    if (!photoId) return Response.json({ error: "Photo ID is required" }, { status: 400 });

    const photo = await getEntityPhotoById(photoId);
    if (!photo || photo.entity_type !== "estimate_line_item" || photo.entity_id !== itemId) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }
    await deleteEntityPhoto(photoId);
    if (photo.s3_key) {
      await deleteFromS3(photo.s3_key);
    }

    return Response.json({ success: true, project_id: id });
  } catch (error) {
    console.error("Error deleting estimate item photo:", error);
    return Response.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}
