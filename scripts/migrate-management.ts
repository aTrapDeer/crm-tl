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

// Helper function to check if a table exists
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
  // Dynamically import turso AFTER env vars are loaded
  const { turso } = await import("../lib/turso");

  console.log("Running management system migration...");
  console.log("This migration will add work orders, documents, and signatures tables.\n");

  // ============ WORK ORDERS TABLE ============
  if (!(await tableExists("work_orders", turso))) {
    try {
      await turso.execute(`
        CREATE TABLE work_orders (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          work_order_number TEXT NOT NULL UNIQUE,
          date TEXT NOT NULL DEFAULT (date('now')),
          time_received TEXT,
          phone TEXT,
          email TEXT,
          company TEXT,
          department TEXT,
          location TEXT,
          unit TEXT,
          area TEXT,
          access_needed TEXT,
          preferred_entry_time TEXT,
          priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'high', 'normal', 'low')),
          service_type TEXT NOT NULL DEFAULT 'maintenance' CHECK (service_type IN ('maintenance', 'repair', 'replace', 'inspection', 'preventive', 'cleaning', 'other')),
          description TEXT NOT NULL,
          assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
          scheduled_date TEXT,
          scheduled_time TEXT,
          time_in TEXT,
          time_out TEXT,
          total_labor_hours REAL,
          work_completed TEXT NOT NULL DEFAULT 'pending' CHECK (work_completed IN ('pending', 'in_progress', 'completed', 'cancelled')),
          completed_date TEXT,
          completed_time TEXT,
          work_summary TEXT,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      console.log("✓ Created work_orders table");
    } catch (e) {
      console.error("✗ Failed to create work_orders table:", e);
      throw e;
    }
  } else {
    console.log("✓ work_orders table already exists");
  }

  // Work orders indexes
  try {
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_number ON work_orders(work_order_number)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(work_completed)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON work_orders(assigned_to)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_project ON work_orders(project_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_date ON work_orders(date)");
    console.log("✓ Created/verified indexes for work_orders");
  } catch (e) {
    console.error("✗ Failed to create work_orders indexes:", e);
    throw e;
  }

  // ============ WORK ORDER MATERIALS TABLE ============
  if (!(await tableExists("work_order_materials", turso))) {
    try {
      await turso.execute(`
        CREATE TABLE work_order_materials (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
          material_name TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unit TEXT,
          unit_cost REAL,
          total_cost REAL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      console.log("✓ Created work_order_materials table");
    } catch (e) {
      console.error("✗ Failed to create work_order_materials table:", e);
      throw e;
    }
  } else {
    console.log("✓ work_order_materials table already exists");
  }

  // Materials index
  try {
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_order_materials_order ON work_order_materials(work_order_id)");
    console.log("✓ Created/verified indexes for work_order_materials");
  } catch (e) {
    console.error("✗ Failed to create work_order_materials indexes:", e);
    throw e;
  }

  // ============ WORK ORDER SIGNATURES TABLE ============
  if (!(await tableExists("work_order_signatures", turso))) {
    try {
      await turso.execute(`
        CREATE TABLE work_order_signatures (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
          signer_type TEXT NOT NULL CHECK (signer_type IN ('tl_corp_rep', 'building_rep')),
          signer_name TEXT NOT NULL,
          signer_title TEXT,
          signature_data TEXT NOT NULL,
          signed_date TEXT NOT NULL DEFAULT (date('now')),
          signed_at TEXT NOT NULL DEFAULT (datetime('now')),
          ip_address TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      console.log("✓ Created work_order_signatures table");
    } catch (e) {
      console.error("✗ Failed to create work_order_signatures table:", e);
      throw e;
    }
  } else {
    console.log("✓ work_order_signatures table already exists");
  }

  // Signatures indexes
  try {
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_order_signatures_order ON work_order_signatures(work_order_id)");
    await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_signatures_unique ON work_order_signatures(work_order_id, signer_type)");
    console.log("✓ Created/verified indexes for work_order_signatures");
  } catch (e) {
    console.error("✗ Failed to create work_order_signatures indexes:", e);
    throw e;
  }

  // ============ DOCUMENTS TABLE ============
  if (!(await tableExists("documents", turso))) {
    try {
      await turso.execute(`
        CREATE TABLE documents (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          filename TEXT NOT NULL,
          display_name TEXT NOT NULL,
          description TEXT,
          file_type TEXT,
          file_size INTEGER,
          s3_key TEXT,
          s3_url TEXT,
          work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          is_public INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      console.log("✓ Created documents table");
    } catch (e) {
      console.error("✗ Failed to create documents table:", e);
      throw e;
    }
  } else {
    console.log("✓ documents table already exists");
  }

  // Documents indexes
  try {
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_documents_work_order ON documents(work_order_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)");
    console.log("✓ Created/verified indexes for documents");
  } catch (e) {
    console.error("✗ Failed to create documents indexes:", e);
    throw e;
  }

  // ============ CLIENT DOCUMENTS TABLE ============
  if (!(await tableExists("client_documents", turso))) {
    try {
      await turso.execute(`
        CREATE TABLE client_documents (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          shared_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          can_download INTEGER NOT NULL DEFAULT 1,
          expires_at TEXT,
          viewed_at TEXT,
          downloaded_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(document_id, client_user_id)
        )
      `);
      console.log("✓ Created client_documents table");
    } catch (e) {
      console.error("✗ Failed to create client_documents table:", e);
      throw e;
    }
  } else {
    console.log("✓ client_documents table already exists");
  }

  // Client documents indexes
  try {
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_client_documents_document ON client_documents(document_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_user_id)");
    console.log("✓ Created/verified indexes for client_documents");
  } catch (e) {
    console.error("✗ Failed to create client_documents indexes:", e);
    throw e;
  }

  console.log("\n✓ Management system migration complete!");
}

migrate().catch((error) => {
  console.error("\n✗ Migration failed:", error);
  process.exit(1);
});
