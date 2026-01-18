import { turso } from "../lib/turso";

async function migrate() {
  console.log("Running migration v2...");

  // Add new columns to projects table
  try {
    await turso.execute(
      "ALTER TABLE projects ADD COLUMN on_hold_reason TEXT"
    );
    console.log("Added on_hold_reason column");
  } catch (e) {
    console.log("on_hold_reason column may already exist");
  }

  try {
    await turso.execute(
      "ALTER TABLE projects ADD COLUMN expected_resume_date TEXT"
    );
    console.log("Added expected_resume_date column");
  } catch (e) {
    console.log("expected_resume_date column may already exist");
  }

  // Create project_invitations table
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS project_invitations (
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
    console.log("Created project_invitations table");
  } catch (e) {
    console.log("project_invitations table may already exist");
  }

  // Create indexes
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
    console.log("Created indexes for project_invitations");
  } catch (e) {
    console.log("Indexes may already exist");
  }

  console.log("Migration v2 complete!");
}

migrate().catch(console.error);
