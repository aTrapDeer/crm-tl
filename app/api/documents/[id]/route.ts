import { getSession, getUserById } from "@/lib/auth";
import {
  getDocumentById,
  updateDocument,
  deleteDocument,
  canClientAccessDocument,
} from "@/lib/documents";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const document = await getDocumentById(id);

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    // Clients can only access documents shared with them
    if (user.role === "client") {
      const hasAccess = await canClientAccessDocument(id, user.id);
      if (!hasAccess) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    return Response.json({ document });
  } catch (error) {
    console.error("Error fetching document:", error);
    return Response.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only admin and worker can update documents
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const document = await getDocumentById(id);

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const body = await request.json();

    const updatedDocument = await updateDocument(id, {
      display_name: body.display_name,
      description: body.description,
      is_public: body.is_public,
      work_order_id: body.work_order_id,
      project_id: body.project_id,
    });

    return Response.json({ document: updatedDocument });
  } catch (error) {
    console.error("Error updating document:", error);
    return Response.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only admin can delete documents
    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can delete documents" }, { status: 403 });
    }

    const { id } = await params;
    const document = await deleteDocument(id);

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    // Return the deleted document info (useful for S3 cleanup)
    return Response.json({ document, deleted: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return Response.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
