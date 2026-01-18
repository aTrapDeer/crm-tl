import { getSession, getUserById } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return Response.json({ user: null });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ user: null });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return Response.json({ user: null });
    }

    return Response.json({ user });
  } catch (error) {
    console.error("Session check error:", error);
    return Response.json({ user: null });
  }
}

