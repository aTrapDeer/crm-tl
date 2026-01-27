// Migration script for work_order_invitations table
import { config } from "dotenv";
import { join } from "path";

// Load environment variables from .env.local
config({ path: join(process.cwd(), ".env.local") });

async function migrate() {
  try {
    const { turso } = await import("../lib/turso");

    console.log("Creating work_order_invitations table...");

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS work_order_invitations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        customer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        accepted_at TEXT
      )
    `);

    console.log("Creating indexes...");

    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_work_order_invitations_order ON work_order_invitations(work_order_id)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_work_order_invitations_email ON work_order_invitations(email)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_work_order_invitations_token ON work_order_invitations(token)`);

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
