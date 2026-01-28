import { getSession, getUserById } from "@/lib/auth";
import {
  getDocumentById,
  shareDocumentWithClient,
  revokeDocumentFromClient,
  getDocumentShares,
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

    // Only admin and employee can view document shares
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const document = await getDocumentById(id);

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const shares = await getDocumentShares(id);

    return Response.json({ shares });
  } catch (error) {
    console.error("Error fetching document shares:", error);
    return Response.json({ error: "Failed to fetch document shares" }, { status: 500 });
  }
}

export async function POST(
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

    // Only admin and employee can share documents
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const document = await getDocumentById(id);

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.client_user_id) {
      return Response.json({ error: "Client user ID is required" }, { status: 400 });
    }

    // Verify the target user is a client
    const clientUser = await getUserById(body.client_user_id);
    if (!clientUser || clientUser.role !== "client") {
      return Response.json({ error: "Target user is not a valid client" }, { status: 400 });
    }

    const share = await shareDocumentWithClient({
      document_id: id,
      client_user_id: body.client_user_id,
      shared_by: user.id,
      can_download: body.can_download,
      expires_at: body.expires_at,
    });

    return Response.json({ share });
  } catch (error) {
    console.error("Error sharing document:", error);
    return Response.json({ error: "Failed to share document" }, { status: 500 });
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

    // Only admin and employee can revoke document access
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const document = await getDocumentById(id);

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.client_user_id) {
      return Response.json({ error: "Client user ID is required" }, { status: 400 });
    }

    await revokeDocumentFromClient(id, body.client_user_id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error revoking document access:", error);
    return Response.json({ error: "Failed to revoke document access" }, { status: 500 });
  }
}
