import { config } from "dotenv";
import { join } from "path";

const envResult = config({ path: join(process.cwd(), ".env.local") });
if (envResult.error) {
  console.warn("Warning: Could not load .env.local:", envResult.error.message);
}

type TursoClient = {
  execute: (
    sql: string,
    args?: Array<string | number | boolean | null>
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

async function tableExists(tableName: string, turso: TursoClient): Promise<boolean> {
  const result = await turso.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName]
  );
  return result.rows.length > 0;
}

async function migrate() {
  const { turso } = await import("../lib/turso");

  console.log("Running project signatures migration...");

  if (!(await tableExists("project_signatures", turso))) {
    await turso.execute(`
      CREATE TABLE project_signatures (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        signer_role TEXT NOT NULL CHECK (signer_role IN ('admin', 'client')),
        signer_name TEXT NOT NULL,
        signature_data TEXT NOT NULL,
        signed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        ip_address TEXT,
        signed_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(project_id, signer_role)
      )
    `);
    console.log("Created project_signatures table");
  } else {
    console.log("project_signatures table already exists");
  }

  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_project_signatures_project ON project_signatures(project_id)"
  );

  console.log("Migration complete");
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
