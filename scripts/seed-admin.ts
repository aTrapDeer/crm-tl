// Load environment variables FIRST
import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

async function seedAdmin() {
  // Import after env vars are loaded
  const { hashPassword } = await import("../lib/auth");
  const { turso } = await import("../lib/turso");

  const adminEmail = "admin@taylorleonard.com";
  const adminPassword = "Admin123!"; // Change this in production!
  const firstName = "Admin";
  const lastName = "User";

  try {
    // Check if admin already exists
    const existing = await turso.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [adminEmail],
    });

    if (existing.rows.length > 0) {
      console.log(`Admin user already exists: ${adminEmail}`);
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(adminPassword);
    const id = crypto.randomUUID().replace(/-/g, "");

    // Create admin user
    await turso.execute({
      sql: `INSERT INTO users (id, email, password_hash, first_name, last_name, role) 
            VALUES (?, ?, ?, ?, ?, 'admin')`,
      args: [id, adminEmail, passwordHash, firstName, lastName],
    });

    console.log("✅ Admin user created successfully!");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log("   ⚠️  Change this password immediately in production!");
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

seedAdmin();

