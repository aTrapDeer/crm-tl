import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  createEstimateCustomEntry,
  getEstimateCustomEntries,
} from "@/lib/projects";

function parsePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  if (!user || user.role !== "admin") return null;

  return user;
}

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await getEstimateCustomEntries();
    return Response.json({ entries });
  } catch (error) {
    console.error("Error fetching estimate custom entries:", error);
    return Response.json(
      { error: "Failed to fetch estimate custom entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    if (!name) {
      return Response.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const entry = await createEstimateCustomEntry({
      name,
      description,
      default_price_rate: parsePositiveNumber(body.default_price_rate, 0),
      default_quantity: parsePositiveNumber(body.default_quantity, 1),
      created_by: user.id,
    });

    return Response.json({ entry });
  } catch (error) {
    console.error("Error creating estimate custom entry:", error);
    return Response.json(
      { error: "Failed to create estimate custom entry" },
      { status: 500 }
    );
  }
}
