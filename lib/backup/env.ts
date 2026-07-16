export interface BackupEnv {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  /** HTTPS /dump endpoint derived from TURSO_DATABASE_URL. */
  dumpUrl: string;
  tursoToken: string;
}

/**
 * Reads and validates the S3 backup credentials and Turso connection info
 * from the environment. Throws a clear error naming the first missing
 * variable so misconfiguration is obvious.
 */
export function getBackupEnv(): BackupEnv {
  const accessKeyId = process.env.IAM_ACCESS_KEY;
  if (!accessKeyId) throw new Error("IAM_ACCESS_KEY is not set.");

  const secretAccessKey = process.env.IAM_SECRET_KEY;
  if (!secretAccessKey) throw new Error("IAM_SECRET_KEY is not set.");

  const region = process.env.AWS_BACKUP_REGION;
  if (!region) throw new Error("AWS_BACKUP_REGION is not set.");

  const bucket = process.env.S3_BUCKET_DB;
  if (!bucket) throw new Error("S3_BUCKET_DB is not set.");

  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) throw new Error("TURSO_DATABASE_URL is not set.");
  if (!databaseUrl.startsWith("libsql://")) {
    throw new Error("Backups require a remote Turso database (libsql:// URL).");
  }

  // Prefer a dedicated read-only token when provided; fall back to the app token.
  const tursoToken = process.env.TURSO_BACKUP_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
  if (!tursoToken) throw new Error("TURSO_AUTH_TOKEN is not set.");

  const dumpUrl = `${databaseUrl.replace(/^libsql:\/\//, "https://").replace(/\/+$/, "")}/dump`;

  return { accessKeyId, secretAccessKey, region, bucket, dumpUrl, tursoToken };
}
