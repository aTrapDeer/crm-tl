// Load environment variables first.
import { config } from "dotenv";
import { join } from "path";

const envResult = config({ path: join(process.cwd(), ".env.local") });
if (envResult.error) {
  console.warn("Warning: Could not load .env.local file:", envResult.error.message);
}

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

async function migrateBonanReports() {
  const { turso } = await import("../lib/turso");

  console.log("Running Bonan reports migration...");

  if (!(await tableExists("bonan_reports", turso as unknown as TursoClient))) {
    await turso.execute(`
      CREATE TABLE bonan_reports (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        site TEXT NOT NULL DEFAULT 'bonan_towers' CHECK (site IN ('bonan_towers')),
        report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
        report_date TEXT NOT NULL DEFAULT (date('now')),
        work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        last_autosaved_at TEXT,
        submitted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created bonan_reports table");
  } else {
    console.log("bonan_reports table already exists");
  }

  await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_reports_type ON bonan_reports(report_type)");
  await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_reports_status ON bonan_reports(status)");
  await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_reports_date ON bonan_reports(report_date)");
  await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_reports_work_order ON bonan_reports(work_order_id)");

  if (!(await tableExists("bonan_report_work_orders", turso as unknown as TursoClient))) {
    await turso.execute(`
      CREATE TABLE bonan_report_work_orders (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        bonan_report_id TEXT NOT NULL REFERENCES bonan_reports(id) ON DELETE CASCADE,
        work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(bonan_report_id, work_order_id)
      )
    `);
    console.log("Created bonan_report_work_orders table");
  } else {
    console.log("bonan_report_work_orders table already exists");
  }

  await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_report_work_orders_report ON bonan_report_work_orders(bonan_report_id)");
  await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_report_work_orders_work_order ON bonan_report_work_orders(work_order_id)");

  if (!(await tableExists("incident_reports", turso as unknown as TursoClient))) {
    await turso.execute(`
      CREATE TABLE incident_reports (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        bonan_report_id TEXT NOT NULL REFERENCES bonan_reports(id) ON DELETE CASCADE,
        report_number TEXT NOT NULL UNIQUE,
        report_date TEXT NOT NULL DEFAULT (date('now')),
        section_key TEXT,
        section_name TEXT NOT NULL,
        incident_time TEXT,
        location TEXT,
        system_area TEXT,
        description TEXT NOT NULL,
        actions_taken TEXT,
        work_order_or_vendor TEXT,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created incident_reports table");
  } else {
    console.log("incident_reports table already exists");
  }

  await turso.execute("CREATE INDEX IF NOT EXISTS idx_incident_reports_bonan_report ON incident_reports(bonan_report_id)");
  await turso.execute("CREATE INDEX IF NOT EXISTS idx_incident_reports_report_number ON incident_reports(report_number)");
  await turso.execute("CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports(status)");
  await turso.execute("CREATE INDEX IF NOT EXISTS idx_incident_reports_date ON incident_reports(report_date)");

  console.log("Bonan reports migration complete");
}

migrateBonanReports().catch((error) => {
  console.error("Bonan reports migration failed:", error);
  process.exit(1);
});
