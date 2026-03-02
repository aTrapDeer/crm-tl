import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getBonanRelatedItems, getBonanReportById } from "@/lib/bonan-reports";

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
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const report = await getBonanReportById(id);
    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    const relatedItems = await getBonanRelatedItems(id);
    if (!relatedItems) {
      return Response.json({ error: "Related items unavailable" }, { status: 404 });
    }

    return Response.json({ relatedItems });
  } catch (error) {
    console.error("Error fetching Bonan related items:", error);
    return Response.json({ error: "Failed to fetch related items" }, { status: 500 });
  }
}
