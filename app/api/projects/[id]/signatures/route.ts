import { cookies, headers } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  getProjectById,
  getProjectsByUserId,
  getProjectSignatures,
  upsertProjectSignature,
} from "@/lib/projects";
import { sendProjectSignatureNotification } from "@/lib/email";

function isDataImage(value: string): boolean {
  return /^data:image\/(png|jpeg|jpg);base64,/.test(value);
}

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

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    if (user.role === "employee") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    if (user.role === "client") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const signatures = await getProjectSignatures(id);
    return Response.json({ signatures });
  } catch (error) {
    console.error("Error fetching project signatures:", error);
    return Response.json(
      { error: "Failed to fetch project signatures" },
      { status: 500 }
    );
  }
}

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
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "client") {
      return Response.json(
        { error: "Only admin and client signatures are supported" },
        { status: 403 }
      );
    }

    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    if (user.role === "client") {
      const assignedProjects = await getProjectsByUserId(user.id);
      const isAssigned = assignedProjects.some((p) => p.id === id);
      if (!isAssigned) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const signerName =
      typeof body.signer_name === "string" ? body.signer_name.trim() : "";
    const signatureData =
      typeof body.signature_data === "string" ? body.signature_data : "";

    if (!signerName || !signatureData) {
      return Response.json(
        { error: "Signer name and signature data are required" },
        { status: 400 }
      );
    }

    if (!isDataImage(signatureData)) {
      return Response.json(
        { error: "Signature must be a PNG or JPEG data URL" },
        { status: 400 }
      );
    }

    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      null;

    const signature = await upsertProjectSignature({
      project_id: id,
      signer_role: user.role === "admin" ? "admin" : "client",
      signer_name: signerName,
      signature_data: signatureData,
      signed_by: user.id,
      ip_address: ipAddress || undefined,
    });

    sendProjectSignatureNotification({
      projectId: id,
      projectName: project.name,
      signerName,
      signerRole: user.role === "admin" ? "admin" : "client",
    }).catch(console.error);

    const signatures = await getProjectSignatures(id);
    return Response.json({ signature, signatures });
  } catch (error) {
    console.error("Error saving project signature:", error);
    return Response.json(
      { error: "Failed to save project signature" },
      { status: 500 }
    );
  }
}
