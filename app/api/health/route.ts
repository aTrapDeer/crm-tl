import { turso } from "@/lib/turso";

export async function GET() {
  try {
    await turso.execute("select 1 as ok");
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}

