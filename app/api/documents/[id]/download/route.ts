import { getSession, getUserById } from "@/lib/auth";
import {
  getDocumentById,
  canClientAccessDocument,
  markDocumentViewed,
  markDocumentDownloaded,
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

    // Clients can only download documents shared with them
    if (user.role === "client") {
      const hasAccess = await canClientAccessDocument(id, user.id);
      if (!hasAccess) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }

      // Track the download for clients
      await markDocumentViewed(id, user.id);
      await markDocumentDownloaded(id, user.id);
    }

    // If the document has an S3 URL, redirect to it
    if (document.s3_url) {
      return Response.json({
        downloadUrl: document.s3_url,
        filename: document.filename,
        display_name: document.display_name,
      });
    }

    // No download URL available
    return Response.json(
      { error: "Download not available for this document" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error processing download:", error);
    return Response.json({ error: "Failed to process download" }, { status: 500 });
  }
}
