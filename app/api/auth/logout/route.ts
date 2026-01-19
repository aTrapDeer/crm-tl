import { deleteSession } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (sessionId) {
      await deleteSession(sessionId);
    }

    cookieStore.delete("session_id");

    return Response.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ error: "Logout failed" }, { status: 500 });
  }
}


