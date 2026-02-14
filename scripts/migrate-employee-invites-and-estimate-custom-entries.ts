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

  console.log("Running employee + estimate custom entries migration...");

  if (!(await tableExists("employee_invitations", turso))) {
    await turso.execute(`
      CREATE TABLE employee_invitations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        accepted_at TEXT,
        accepted_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log("Created employee_invitations table");
  } else {
    console.log("employee_invitations table already exists");
  }

  if (!(await tableExists("employee_onboarding", turso))) {
    await turso.execute(`
      CREATE TABLE employee_onboarding (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        completed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created employee_onboarding table");
  } else {
    console.log("employee_onboarding table already exists");
  }

  if (!(await tableExists("estimate_custom_entries", turso))) {
    await turso.execute(`
      CREATE TABLE estimate_custom_entries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        description TEXT,
        default_price_rate REAL NOT NULL DEFAULT 0,
        default_quantity REAL NOT NULL DEFAULT 1,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created estimate_custom_entries table");
  } else {
    console.log("estimate_custom_entries table already exists");
  }

  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email)"
  );
  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(token)"
  );
  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status)"
  );
  await turso.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_custom_entries_name_unique ON estimate_custom_entries(lower(name))"
  );

  console.log("Migration complete");
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
