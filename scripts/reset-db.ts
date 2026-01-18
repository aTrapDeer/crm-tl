// Load environment variables FIRST, before any other imports
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
const envResult = config({ path: join(process.cwd(), ".env.local") });

if (envResult.error) {
  console.warn("Warning: Could not load .env.local file:", envResult.error.message);
}

async function resetDatabase() {
  try {
    // Dynamically import turso AFTER env vars are loaded
    const { turso } = await import("../lib/turso");
    
    console.log("Dropping existing tables...");
    
    // Drop tables in reverse order of dependencies
    const dropStatements = [
      "DROP TABLE IF EXISTS sessions",
      "DROP TABLE IF EXISTS project_images",
      "DROP TABLE IF EXISTS project_tasks",
      "DROP TABLE IF EXISTS project_updates",
      "DROP TABLE IF EXISTS project_assignments",
      "DROP TABLE IF EXISTS projects",
      "DROP TABLE IF EXISTS users",
    ];

    for (const statement of dropStatements) {
      console.log(`  ${statement}`);
      await turso.execute(statement);
    }

    console.log("\nReading schema file...");
    const schemaPath = join(process.cwd(), "db", "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    console.log("Executing schema...");
    // Split by semicolons and filter out empty statements
    const statements = schema
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        await turso.execute(statement);
      }
    }

    console.log("\n✅ Database reset and schema initialized successfully!");
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    process.exit(1);
  }
}

resetDatabase();

