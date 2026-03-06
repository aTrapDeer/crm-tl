import { cookies } from "next/headers";
import { getSession, getUserById, getUserByEmail } from "@/lib/auth";
import {
  getBonanClientMemberships,
  upsertBonanClientMembership,
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
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "client") {
      const memberships = await getBonanClientMemberships({ userId: user.id });
      return Response.json({ memberships });
    }

    if (user.role !== "admin") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const memberships = await getBonanClientMemberships();
    return Response.json({ memberships });
  } catch (error) {
    console.error("Error fetching Bonan clients:", error);
    return Response.json({ error: "Failed to fetch Bonan clients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Only admins can add Bonan clients" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    let userId = typeof body.user_id === "string" ? body.user_id.trim() : "";

    if (!userId && typeof body.email === "string") {
      const existingUser = await getUserByEmail(body.email);
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    if (!userId) {
      return Response.json({ error: "A valid client user is required" }, { status: 400 });
    }

    const membership = await upsertBonanClientMembership({
      user_id: userId,
      company_name: typeof body.company_name === "string" ? body.company_name.trim() : null,
      display_name: typeof body.display_name === "string" ? body.display_name.trim() : null,
      created_by: user.id,
    });

    return Response.json({ membership }, { status: 201 });
  } catch (error) {
    console.error("Error creating Bonan client membership:", error);
    return Response.json({ error: "Failed to create Bonan client membership" }, { status: 500 });
  }
}
