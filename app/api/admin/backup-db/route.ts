import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSession, getUserById } from "@/lib/auth";
import { runDatabaseBackup } from "@/lib/backup/run-backup";
import { canManageBackups, getNextScheduledBackup } from "@/lib/backup/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const user = await getUserById(session.user_id);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can run backups." }, { status: 403 });
    }
    if (!canManageBackups(user.email)) {
      return NextResponse.json({ error: "Backup access is restricted." }, { status: 403 });
    }

    const result = await runDatabaseBackup("manual");
    return NextResponse.json({
      ok: true,
      ...result,
      nextScheduledUtc: getNextScheduledBackup().toISOString(),
    });
  } catch (error) {
    console.error("[backup-db] manual backup failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup failed." },
      { status: 500 },
    );
  }
}
