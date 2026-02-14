import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  completeEmployeeOnboarding,
  getEmployeeOnboardingStatus,
} from "@/lib/employees";

async function getEmployeeUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  if (!user || user.role !== "employee") return null;

  return user;
}

export async function GET() {
  try {
    const user = await getEmployeeUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const onboarding = await getEmployeeOnboardingStatus(user.id);
    return Response.json({ onboarding });
  } catch (error) {
    console.error("Error fetching employee onboarding status:", error);
    return Response.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await getEmployeeUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const onboarding = await completeEmployeeOnboarding(user.id);
    return Response.json({ onboarding });
  } catch (error) {
    console.error("Error completing employee onboarding:", error);
    return Response.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
