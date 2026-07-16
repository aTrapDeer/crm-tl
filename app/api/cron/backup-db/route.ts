import { NextResponse } from "next/server";

import { runDatabaseBackup } from "@/lib/backup/run-backup";
import { isMidnightHourCentral } from "@/lib/backup/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Two UTC crons (05:00 and 06:00) cover both DST offsets; only the one that
  // lands in the midnight hour Central actually backs up.
  if (!isMidnightHourCentral()) {
    return NextResponse.json({ ok: true, skipped: "Not midnight in America/Chicago." });
  }

  try {
    const result = await runDatabaseBackup("cron");
    console.log(`[backup-db] cron backup uploaded s3://${result.bucket}/${result.key}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[backup-db] cron backup failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup failed." },
      { status: 500 },
    );
  }
}
