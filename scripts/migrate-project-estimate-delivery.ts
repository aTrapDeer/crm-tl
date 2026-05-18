import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

type TursoClient = {
  execute: (
    sql: string,
    args?: Array<string | number | boolean | null>
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

async function tableExists(tableName: string, turso: TursoClient): Promise<boolean> {
  const result = await turso.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  return result.rows.length > 0;
}

async function migrate() {
  const { turso } = await import("../lib/turso");

  console.log("Running project estimate delivery migration...\n");

  if (!(await tableExists("project_estimate_settings", turso))) {
    await turso.execute(`
      CREATE TABLE project_estimate_settings (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        markup_type TEXT NOT NULL DEFAULT 'percentage' CHECK (markup_type IN ('percentage', 'fixed')),
        markup_value REAL NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        servicing_fee INTEGER NOT NULL DEFAULT 1,
        installment_schedule TEXT NOT NULL DEFAULT '[]',
        custom_terms TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created project_estimate_settings table");
  } else {
    console.log("project_estimate_settings table already exists");
  }

  if (!(await tableExists("project_estimate_deliveries", turso))) {
    await turso.execute(`
      CREATE TABLE project_estimate_deliveries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        sent_to_email TEXT NOT NULL,
        recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        snapshot_line_items TEXT NOT NULL,
        snapshot_settings TEXT NOT NULL,
        snapshot_total REAL NOT NULL DEFAULT 0,
        tracking_token TEXT NOT NULL UNIQUE,
        sent_at TEXT NOT NULL DEFAULT (datetime('now')),
        email_opened_at TEXT,
        first_viewed_at TEXT,
        status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'revoked'))
      )
    `);
    console.log("Created project_estimate_deliveries table");
  } else {
    console.log("project_estimate_deliveries table already exists");
  }

  if (!(await tableExists("project_estimate_events", turso))) {
    await turso.execute(`
      CREATE TABLE project_estimate_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        delivery_id TEXT NOT NULL REFERENCES project_estimate_deliveries(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'email_opened', 'viewed_in_app')),
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created project_estimate_events table");
  } else {
    console.log("project_estimate_events table already exists");
  }

  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_estimate_deliveries_project ON project_estimate_deliveries(project_id)"
  );
  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_estimate_deliveries_token ON project_estimate_deliveries(tracking_token)"
  );
  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_estimate_deliveries_status ON project_estimate_deliveries(project_id, status)"
  );
  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_estimate_events_delivery ON project_estimate_events(delivery_id)"
  );

  console.log("\nProject estimate delivery migration complete!");
}

migrate().catch((error) => {
  console.error("\nMigration failed:", error);
  process.exit(1);
});
