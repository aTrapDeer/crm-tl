import { getSession, getUserById } from "@/lib/auth";
import {
  getWorkOrderById,
  getWorkOrderSignatures,
  addWorkOrderSignature,
} from "@/lib/work-orders";
import { sendSignatureAlertEmail } from "@/lib/email";
import { cookies, headers } from "next/headers";

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

    // Only admin and employee can access signatures
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Employees can only see signatures for work orders assigned to them
    if (user.role === "employee" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const signatures = await getWorkOrderSignatures(id);

    return Response.json({ signatures });
  } catch (error) {
    console.error("Error fetching signatures:", error);
    return Response.json({ error: "Failed to fetch signatures" }, { status: 500 });
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

    // Only admin and employee can add signatures
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);

    if (!workOrder) {
      return Response.json({ error: "Work order not found" }, { status: 404 });
    }

    // Employees can only add signatures to work orders assigned to them
    if (user.role === "employee" && workOrder.assigned_to !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.signer_type || !body.signer_name || !body.signature_data) {
      return Response.json(
        { error: "Signer type, name, and signature data are required" },
        { status: 400 }
      );
    }

    // Validate signer_type
    if (!["tl_corp_rep", "building_rep"].includes(body.signer_type)) {
      return Response.json(
        { error: "Invalid signer type" },
        { status: 400 }
      );
    }

    // Get client IP address
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      null;

    const signature = await addWorkOrderSignature({
      work_order_id: id,
      signer_type: body.signer_type,
      signer_name: body.signer_name,
      signer_title: body.signer_title,
      signature_data: body.signature_data,
      ip_address: ipAddress || undefined,
    });

    // Send signature alert email to all associated parties
    sendSignatureAlertEmail({
      workOrderId: id,
      workOrderNumber: workOrder.work_order_number,
      signerType: body.signer_type,
      signerName: body.signer_name,
      signerTitle: body.signer_title,
      company: workOrder.company || undefined,
      location: workOrder.location || undefined,
    }).catch(console.error);

    return Response.json({ signature });
  } catch (error) {
    console.error("Error adding signature:", error);
    return Response.json({ error: "Failed to add signature" }, { status: 500 });
  }
}
