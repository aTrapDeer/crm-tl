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

  console.log("Running users role migration (worker -> employee)...");

  if (!(await tableExists("users", turso))) {
    throw new Error("users table does not exist");
  }

  const schemaResult = await turso.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
  );
  const usersTableSql = (schemaResult.rows[0]?.sql as string | undefined) || "";
  const usesWorkerConstraint = usersTableSql.includes("'worker'");

  const roleCountsBefore = await turso.execute(
    "SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role"
  );
  console.log("Role counts before migration:", roleCountsBefore.rows);

  if (!usesWorkerConstraint) {
    // Table already allows employee. Still normalize any lingering worker rows.
    await turso.execute("UPDATE users SET role = 'employee' WHERE role = 'worker'");
    const roleCountsAfterSoftFix = await turso.execute(
      "SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role"
    );
    console.log("No table rebuild needed; normalized existing worker rows.");
    console.log("Role counts after normalization:", roleCountsAfterSoftFix.rows);
    return;
  }

  await turso.execute("PRAGMA foreign_keys = OFF");
  await turso.execute("BEGIN TRANSACTION");

  try {
    await turso.execute(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'employee', 'client')),
        phone TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(`
      INSERT INTO users_new (
        id, email, password_hash, first_name, last_name, role, phone, created_at, updated_at
      )
      SELECT
        id,
        email,
        password_hash,
        first_name,
        last_name,
        CASE
          WHEN role = 'worker' THEN 'employee'
          WHEN role IN ('admin', 'employee', 'client') THEN role
          ELSE 'client'
        END as role,
        phone,
        COALESCE(created_at, datetime('now')),
        COALESCE(updated_at, datetime('now'))
      FROM users
    `);

    await turso.execute("DROP TABLE users");
    await turso.execute("ALTER TABLE users_new RENAME TO users");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");

    await turso.execute("COMMIT");
    await turso.execute("PRAGMA foreign_keys = ON");
  } catch (error) {
    try {
      await turso.execute("ROLLBACK");
    } catch {
      // Some Turso/SQLite DDL paths auto-close transactions; ignore rollback noise.
    }
    await turso.execute("PRAGMA foreign_keys = ON");
    throw error;
  }

  const roleCountsAfter = await turso.execute(
    "SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role"
  );
  console.log("Migration complete.");
  console.log("Role counts after migration:", roleCountsAfter.rows);
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
