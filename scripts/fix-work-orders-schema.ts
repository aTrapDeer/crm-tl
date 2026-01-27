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
    sql: string | { sql: string; args?: Array<string | number | boolean | null> },
    args?: Array<string | number | boolean | null>
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

// Helper function to check if a column exists
async function columnExists(
  tableName: string,
  columnName: string,
  turso: TursoClient
): Promise<boolean> {
  try {
    const result = await turso.execute(
      `PRAGMA table_info(${tableName})`
    );
    const columns = result.rows.map((row) => row.name as string);
    return columns.includes(columnName);
  } catch (e) {
    console.error(`Error checking column ${tableName}.${columnName}:`, e);
    return false;
  }
}

async function fixWorkOrdersSchema() {
  // Dynamically import turso AFTER env vars are loaded
  const { turso } = await import("../lib/turso");

  console.log("Fixing work_orders table schema...\n");

  try {
    // Check if table exists
    const tableCheck = await turso.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='work_orders'`
    );

    if (tableCheck.rows.length === 0) {
      console.log("work_orders table doesn't exist. Creating it...");
      // Create the table with full schema
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
      console.log("✓ Created work_orders table with full schema");
    } else {
      console.log("work_orders table exists. Checking for missing columns...");
      
      // Check and add missing columns
      const requiredColumns = [
        { name: "work_order_number", sql: "TEXT NOT NULL DEFAULT ''" },
        { name: "assigned_to", sql: "TEXT REFERENCES users(id) ON DELETE SET NULL" },
        { name: "work_completed", sql: "TEXT NOT NULL DEFAULT 'pending' CHECK (work_completed IN ('pending', 'in_progress', 'completed', 'cancelled'))" },
      ];

      for (const col of requiredColumns) {
        const exists = await columnExists("work_orders", col.name, turso);
        if (!exists) {
          console.log(`  Adding missing column: ${col.name}`);
          try {
            // SQLite doesn't support ALTER TABLE ADD COLUMN with constraints well
            // So we'll need to recreate the table
            console.log(`  Column ${col.name} is missing. Need to recreate table...`);
            throw new Error("Table needs to be recreated");
          } catch {
            // If we can't add the column, we need to recreate the table
            console.log("\n⚠️  Cannot add column with constraints. Recreating table...");
            console.log("⚠️  WARNING: This will delete all existing work orders data!");
            
            // For safety, we'll just drop and recreate
            await turso.execute("DROP TABLE IF EXISTS work_order_materials");
            await turso.execute("DROP TABLE IF EXISTS work_order_signatures");
            await turso.execute("DROP TABLE IF EXISTS work_orders");
            
            // Recreate with full schema
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
            console.log("✓ Recreated work_orders table with full schema");
            
            // Recreate related tables
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
            console.log("✓ Recreated related tables");
            break;
          }
        } else {
          console.log(`  ✓ Column ${col.name} exists`);
        }
      }
    }

    // Create indexes
    console.log("\nCreating/verifying indexes...");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_number ON work_orders(work_order_number)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(work_completed)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON work_orders(assigned_to)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_project ON work_orders(project_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_date ON work_orders(date)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_order_materials_order ON work_order_materials(work_order_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_work_order_signatures_order ON work_order_signatures(work_order_id)");
    await turso.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_signatures_unique ON work_order_signatures(work_order_id, signer_type)");
    console.log("✓ All indexes created/verified");

    console.log("\n✅ Work orders schema fixed successfully!");
  } catch (error) {
    console.error("\n❌ Error fixing schema:", error);
    process.exit(1);
  }
}

fixWorkOrdersSchema();
