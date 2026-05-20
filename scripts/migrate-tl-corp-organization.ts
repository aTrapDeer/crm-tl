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

  console.log("Running TL Corp organization migration...\n");

  if (!(await tableExists("tl_corp_organization", turso))) {
    await turso.execute(`
      CREATE TABLE tl_corp_organization (
        id TEXT PRIMARY KEY DEFAULT 'default',
        registration_label TEXT NOT NULL DEFAULT 'Business Registered at',
        business_name TEXT NOT NULL DEFAULT 'TAYLOR LEONARD CONSTRUCTION CORP.',
        phone TEXT NOT NULL DEFAULT '3144893229',
        email TEXT NOT NULL DEFAULT 'taylorleonardcorp@gmail.com',
        address_line1 TEXT NOT NULL DEFAULT '4717 Don Ron Drive',
        city_state TEXT NOT NULL DEFAULT 'ST. LOUIS MO',
        postal_code TEXT NOT NULL DEFAULT '63123',
        website TEXT NOT NULL DEFAULT 'www.TLcorp.build',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("Created tl_corp_organization table");
  } else {
    console.log("tl_corp_organization table already exists");
  }

  const existing = await turso.execute(
    "SELECT id FROM tl_corp_organization WHERE id = 'default'"
  );
  if (existing.rows.length === 0) {
    await turso.execute(`
      INSERT INTO tl_corp_organization (
        id, registration_label, business_name, phone, email,
        address_line1, city_state, postal_code, website
      ) VALUES (
        'default',
        'Business Registered at',
        'TAYLOR LEONARD CONSTRUCTION CORP.',
        '3144893229',
        'taylorleonardcorp@gmail.com',
        '4717 Don Ron Drive',
        'ST. LOUIS MO',
        '63123',
        'www.TLcorp.build'
      )
    `);
    console.log("Seeded default organization row");
  } else {
    console.log("Default organization row already exists");
  }

  console.log("\nTL Corp organization migration complete!");
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
