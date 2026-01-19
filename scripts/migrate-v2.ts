import { turso } from "../lib/turso";

// Helper function to check if a column exists in a table
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await turso.execute(
      `PRAGMA table_info(${tableName})`
    );
    const columns = result.rows as Array<{ name: string }>;
    return columns.some((col) => col.name === columnName);
  } catch {
    // If PRAGMA fails, assume column doesn't exist (safer to try adding it)
    return false;
  }
}

// Helper function to check if a table exists
async function tableExists(tableName: string): Promise<boolean> {
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
  console.log("Running migration v2...");
  console.log("This migration will preserve all existing data.\n");

  // Add new columns to projects table
  if (!(await columnExists("projects", "on_hold_reason"))) {
    try {
      await turso.execute(
        "ALTER TABLE projects ADD COLUMN on_hold_reason TEXT"
      );
      console.log("✓ Added on_hold_reason column to projects table");
    } catch (e) {
      console.error("✗ Failed to add on_hold_reason column:", e);
      throw e;
    }
  } else {
    console.log("✓ on_hold_reason column already exists");
  }

  if (!(await columnExists("projects", "expected_resume_date"))) {
    try {
      await turso.execute(
        "ALTER TABLE projects ADD COLUMN expected_resume_date TEXT"
      );
      console.log("✓ Added expected_resume_date column to projects table");
    } catch (e) {
      console.error("✗ Failed to add expected_resume_date column:", e);
      throw e;
    }
  } else {
    console.log("✓ expected_resume_date column already exists");
  }

  // Create project_invitations table
  if (!(await tableExists("project_invitations"))) {
    try {
      await turso.execute(`
        CREATE TABLE project_invitations (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          accepted_at TEXT
        )
      `);
      console.log("✓ Created project_invitations table");
    } catch (e) {
      console.error("✗ Failed to create project_invitations table:", e);
      throw e;
    }
  } else {
    console.log("✓ project_invitations table already exists");
  }

  // Create indexes (using IF NOT EXISTS for safety)
  try {
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token)"
    );
    console.log("✓ Created/verified indexes for project_invitations");
  } catch (e) {
    console.error("✗ Failed to create indexes:", e);
    throw e;
  }

  console.log("\n✓ Migration v2 complete! All existing data has been preserved.");
}

migrate().catch((error) => {
  console.error("\n✗ Migration failed:", error);
  process.exit(1);
});
