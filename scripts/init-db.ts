// Load environment variables FIRST, before any other imports
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
const envResult = config({ path: join(process.cwd(), ".env.local") });

if (envResult.error) {
  console.warn("Warning: Could not load .env.local file:", envResult.error.message);
}

async function initDatabase() {
  try {
    // Dynamically import turso AFTER env vars are loaded
    const { turso } = await import("../lib/turso");
    
    console.log("Reading schema file...");
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

    console.log("✅ Database schema initialized successfully!");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    process.exit(1);
  }
}

initDatabase();

