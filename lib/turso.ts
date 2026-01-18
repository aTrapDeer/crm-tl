import { createClient } from "@libsql/client";

const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DB_URL ??
  process.env["db-url"];
const authToken =
  process.env.TURSO_AUTH_TOKEN ??
  process.env.DB_TOKEN ??
  process.env["db-token"];

if (!url) {
  throw new Error(
    "Missing Turso database URL. Set TURSO_DATABASE_URL or DB_URL (or db-url)."
  );
}

export const turso = createClient({
  url,
  authToken,
});
