import { config } from "dotenv";
import { join } from "path";

const envResult = config({ path: join(process.cwd(), ".env.local") });
if (envResult.error) {
  console.warn("Warning: Could not load .env.local file:", envResult.error.message);
}

async function migrateBonanClientAccess() {
  const { ensureBonanClientSchema } = await import("../lib/bonan-client");

  console.log("Running Bonan client access migration...");
  await ensureBonanClientSchema();
  console.log("Bonan client access migration complete.");
}

migrateBonanClientAccess().catch((error) => {
  console.error("Bonan client access migration failed:", error);
  process.exit(1);
});
