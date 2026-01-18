import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectImages,
  addProjectImage,
  updateProjectImage,
  deleteProjectImage,
  getProjectsByUserId,
} from "@/lib/projects";
import { uploadToS3, deleteFromS3, generateS3Key, isS3Configured } from "@/lib/s3";
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

    const images = await getProjectImages(id);
    return Response.json({ images, s3Configured: isS3Configured() });
  } catch (error) {
    console.error("Error fetching images:", error);
    return Response.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(
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

    // Only admins and workers can upload images
    if (user.role === "client") {
      return Response.json({ error: "Clients cannot upload images" }, { status: 403 });
    }

    // Workers can only upload to assigned projects
    if (user.role === "worker") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === projectId);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const contentType = request.headers.get("content-type") || "";
    
    // Handle form data upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const caption = formData.get("caption") as string | null;

      if (!file) {
        return Response.json({ error: "No file provided" }, { status: 400 });
      }

      const filename = file.name;
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const fileType = file.type;

      // Try to upload to S3 (will use placeholder if not configured)
      const s3Result = await uploadToS3(projectId, filename, fileBuffer, fileType);

      const image = await addProjectImage({
        project_id: projectId,
        filename,
        s3_key: s3Result.key,
        s3_url: s3Result.url,
        caption: caption || undefined,
        uploaded_by: user.id,
      });

      return Response.json({ 
        image, 
        s3Configured: isS3Configured(),
        message: isS3Configured() 
          ? "Image uploaded successfully" 
          : "Image record created (S3 not configured - file not actually uploaded)"
      });
    }
    
    // Handle JSON body (for adding image metadata without actual file)
    const body = await request.json();
    const { filename, caption, s3_key, s3_url } = body;

    if (!filename) {
      return Response.json({ error: "Filename is required" }, { status: 400 });
    }

    // Generate placeholder S3 key/url if not provided
    const key = s3_key || generateS3Key(projectId, filename);
    const url = s3_url || `https://crm-tl.s3.us-east-1.amazonaws.com/${key}`;

    const image = await addProjectImage({
      project_id: projectId,
      filename,
      s3_key: key,
      s3_url: url,
      caption,
      uploaded_by: user.id,
    });

    return Response.json({ 
      image, 
      s3Configured: isS3Configured(),
      message: "Image record created (placeholder - S3 not configured)"
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return Response.json({ error: "Failed to upload image" }, { status: 500 });
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

    // Only admins and workers can update images
    if (user.role === "client") {
      return Response.json({ error: "Clients cannot update images" }, { status: 403 });
    }

    // Workers can only update on assigned projects
    if (user.role === "worker") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === projectId);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { imageId, caption } = body;

    if (!imageId) {
      return Response.json({ error: "Image ID is required" }, { status: 400 });
    }

    const image = await updateProjectImage(imageId, { caption });

    if (!image) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    return Response.json({ image });
  } catch (error) {
    console.error("Error updating image:", error);
    return Response.json({ error: "Failed to update image" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // Validate params exist
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

    // Only admins can delete images
    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can delete images" }, { status: 403 });
    }

    const body = await request.json();
    const { imageId } = body;

    if (!imageId) {
      return Response.json({ error: "Image ID is required" }, { status: 400 });
    }

    const deletedImage = await deleteProjectImage(imageId);

    if (!deletedImage) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    // Try to delete from S3 if key exists
    if (deletedImage.s3_key) {
      await deleteFromS3(deletedImage.s3_key);
    }

    return Response.json({ 
      success: true, 
      message: isS3Configured() 
        ? "Image deleted from S3" 
        : "Image record deleted (S3 not configured)"
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return Response.json({ error: "Failed to delete image" }, { status: 500 });
  }
}

