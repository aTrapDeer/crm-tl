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

async function tableHasColumn(
  tableName: string,
  columnName: string,
  turso: TursoClient
): Promise<boolean> {
  const result = await turso.execute(`PRAGMA table_info(${tableName})`);
  return result.rows.some((row) => row.name === columnName);
}

async function addColumnIfMissing(
  tableName: string,
  columnName: string,
  definitionSql: string,
  turso: TursoClient
) {
  const hasColumn = await tableHasColumn(tableName, columnName, turso);
  if (hasColumn) {
    console.log(`Column ${tableName}.${columnName} already exists`);
    return;
  }

  await turso.execute(`ALTER TABLE ${tableName} ADD COLUMN ${definitionSql}`);
  console.log(`Added column ${tableName}.${columnName}`);
}

async function migratePublicationStatus() {
  const { turso } = await import("../lib/turso");
  const client = turso as unknown as TursoClient;

  console.log("Running publication status migration...");

  if (await tableExists("work_orders", client)) {
    await addColumnIfMissing(
      "work_orders",
      "publication_status",
      "publication_status TEXT NOT NULL DEFAULT 'draft'",
      client
    );
    await addColumnIfMissing(
      "work_orders",
      "published_at",
      "published_at TEXT",
      client
    );
  } else {
    console.log("work_orders table not found, skipping.");
  }

  if (await tableExists("incident_reports", client)) {
    await addColumnIfMissing(
      "incident_reports",
      "publication_status",
      "publication_status TEXT NOT NULL DEFAULT 'draft'",
      client
    );
    await addColumnIfMissing(
      "incident_reports",
      "published_at",
      "published_at TEXT",
      client
    );
  } else {
    console.log("incident_reports table not found, skipping.");
  }

  console.log("Publication status migration complete.");
}

migratePublicationStatus().catch((error) => {
  console.error("Publication status migration failed:", error);
  process.exit(1);
});
