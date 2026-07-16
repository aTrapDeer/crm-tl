// Load environment variables FIRST
import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

async function main() {
  // Import after env vars are loaded
  const { runDatabaseBackup } = await import("../lib/backup/run-backup");
  const { formatCentral, getNextScheduledBackup, isMidnightHourCentral } = await import(
    "../lib/backup/schedule"
  );

  console.log("Next scheduled backup:", formatCentral(getNextScheduledBackup()));
  console.log("Is midnight hour Central right now:", isMidnightHourCentral());

  const result = await runDatabaseBackup("manual");
  console.log("Uploaded:", `s3://${result.bucket}/${result.key}`);
  console.log("Dump size:", result.dumpBytes, "bytes; compressed:", result.uploadedBytes, "bytes");
}

main().catch((error) => {
  console.error("Backup test failed:", error);
  process.exit(1);
});
