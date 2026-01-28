import { getSession, getUserById } from "@/lib/auth";
import {
  getAllDocuments,
  createDocument,
  getDocumentsSharedWithClient,
  getFileTypeFromExtension,
} from "@/lib/documents";
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

    // Clients only see documents shared with them
    if (user.role === "client") {
      const sharedDocs = await getDocumentsSharedWithClient(user.id);
      return Response.json({
        documents: sharedDocs.map((sd) => sd.document),
        shares: sharedDocs,
      });
    }

    // Admin and employee see all documents
    const documents = await getAllDocuments();

    return Response.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
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
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin and employee can upload documents
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.filename || !body.display_name) {
      return Response.json(
        { error: "Filename and display name are required" },
        { status: 400 }
      );
    }

    const fileType = body.file_type || getFileTypeFromExtension(body.filename);

    const document = await createDocument({
      filename: body.filename,
      display_name: body.display_name,
      description: body.description,
      file_type: fileType,
      file_size: body.file_size,
      s3_key: body.s3_key,
      s3_url: body.s3_url,
      work_order_id: body.work_order_id,
      project_id: body.project_id,
      uploaded_by: user.id,
      is_public: body.is_public,
    });

    return Response.json({ document });
  } catch (error) {
    console.error("Error creating document:", error);
    return Response.json({ error: "Failed to create document" }, { status: 500 });
  }
}
