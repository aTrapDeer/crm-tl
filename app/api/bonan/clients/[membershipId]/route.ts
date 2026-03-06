import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { deactivateBonanClientMembership } from "@/lib/bonan-client";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can remove Bonan clients" }, { status: 403 });
    }

    const { membershipId } = await params;
    const removed = await deactivateBonanClientMembership(membershipId);
    if (!removed) {
      return Response.json({ error: "Membership not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error removing Bonan client membership:", error);
    return Response.json({ error: "Failed to remove Bonan client membership" }, { status: 500 });
  }
}
