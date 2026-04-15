import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { searchWorkOrders } from "@/lib/work-orders";
import { isBonanClientVisibleWorkOrder } from "@/lib/bonan-visibility";
import {
  getBonanClientDecisionsForEntities,
  userHasBonanClientMembership,
} from "@/lib/bonan-client";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "client") {
      return Response.json({ error: "Only Bonan clients can view Bonan work orders" }, { status: 403 });
    }
    if (!(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const workOrders = (await searchWorkOrders({
      site: "bonan_towers",
    })).filter(isBonanClientVisibleWorkOrder);

    const decisions = await getBonanClientDecisionsForEntities(
      "work_order",
      workOrders.map((workOrder) => workOrder.id)
    );

    const workOrdersWithDecisions = workOrders.map((workOrder) => ({
      ...workOrder,
      client_decision:
        decisions.find(
          (decision) =>
            decision.entity_id === workOrder.id &&
            decision.entity_revision === workOrder.client_visible_revision
        ) || null,
    }));

    return Response.json({ workOrders: workOrdersWithDecisions });
  } catch (error) {
    console.error("Error fetching Bonan client work orders:", error);
    return Response.json({ error: "Failed to fetch Bonan work orders" }, { status: 500 });
  }
}
