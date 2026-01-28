import { getSession, getUserById } from "@/lib/auth";
import { generateWorkOrderNumber } from "@/lib/work-orders";
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

    // Only admin and employee can generate work order numbers
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const workOrderNumber = await generateWorkOrderNumber();

    return Response.json({ workOrderNumber });
  } catch (error) {
    console.error("Error generating work order number:", error);
    return Response.json({ error: "Failed to generate work order number" }, { status: 500 });
  }
}
