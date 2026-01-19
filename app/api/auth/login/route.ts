import { login } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await login(email, password);

    if (!result) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session_id", result.session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(result.session.expires_at),
      path: "/",
    });

    return Response.json({ user: result.user, success: true });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}


