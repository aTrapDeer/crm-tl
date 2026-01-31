// Load environment variables FIRST, before any other imports
import { config } from "dotenv";
import { join } from "path";

// Load environment variables from .env.local
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

async function tableExists(
  tableName: string,
  turso: TursoClient
): Promise<boolean> {
  try {
    const result = await turso.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return result.rows.length > 0;
  } catch (e) {
    console.error(`Error checking table ${tableName}:`, e);
    return false;
  }
}

async function migrate() {
  const { turso } = await import("../lib/turso");

  console.log("Running estimate builder migration...");
  console.log("This migration will preserve all existing data.\n");

  if (!(await tableExists("estimate_line_items", turso))) {
    try {
      await turso.execute(`
        CREATE TABLE estimate_line_items (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          custom_category_name TEXT,
          description TEXT,
          price_rate REAL NOT NULL DEFAULT 0,
          quantity REAL NOT NULL DEFAULT 1,
          total REAL NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      console.log("Created estimate_line_items table");
    } catch (e) {
      console.error("Failed to create estimate_line_items table:", e);
      throw e;
    }
  } else {
    console.log("estimate_line_items table already exists");
  }

  try {
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_estimate_line_items_project ON estimate_line_items(project_id)"
    );
    console.log("Created/verified indexes for estimate_line_items");
  } catch (e) {
    console.error("Failed to create indexes:", e);
    throw e;
  }

  console.log("\nEstimate builder migration complete!");
}

migrate().catch((error) => {
  console.error("\nMigration failed:", error);
  process.exit(1);
});
