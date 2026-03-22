import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getWorkOrderById } from "@/lib/work-orders";
import { isBonanClientVisibleWorkOrder } from "@/lib/bonan-visibility";
import { userHasBonanClientMembership } from "@/lib/bonan-client";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can view Bonan work orders" }, { status: 403 });
    }
    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const { id } = await params;
    const workOrder = await getWorkOrderById(id);
    if (!workOrder || !isBonanClientVisibleWorkOrder(workOrder)) {
      return Response.json({ error: "Bonan work order not found" }, { status: 404 });
    }

    return Response.json({ workOrder });
  } catch (error) {
    console.error("Error fetching Bonan client work order:", error);
    return Response.json({ error: "Failed to fetch Bonan work order" }, { status: 500 });
  }
}
