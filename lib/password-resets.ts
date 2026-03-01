import { createHash, randomBytes } from "crypto";
import { turso } from "./turso";

interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

let passwordResetTableReady = false;
let passwordResetTableReadyPromise: Promise<void> | null = null;

async function ensurePasswordResetTable(): Promise<void> {
  if (passwordResetTableReady) return;
  if (passwordResetTableReadyPromise) {
    await passwordResetTableReadyPromise;
    return;
  }

  passwordResetTableReadyPromise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used_at ON password_reset_tokens(used_at)"
    );

    passwordResetTableReady = true;
  })();

  try {
    await passwordResetTableReadyPromise;
  } finally {
    passwordResetTableReadyPromise = null;
  }
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapPasswordResetTokenRow(row: Record<string, unknown>): PasswordResetTokenRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    token_hash: row.token_hash as string,
    expires_at: row.expires_at as string,
    used_at: row.used_at as string | null,
    created_at: row.created_at as string,
  };
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  await ensurePasswordResetTable();

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(rawToken);
  const id = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await turso.execute({
    sql: `UPDATE password_reset_tokens
          SET used_at = datetime('now')
          WHERE user_id = ? AND used_at IS NULL`,
    args: [userId],
  });

  await turso.execute({
    sql: `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, ?)`,
    args: [id, userId, tokenHash, expiresAt],
  });

  return rawToken;
}

export async function getValidPasswordResetToken(
  token: string
): Promise<PasswordResetTokenRow | null> {
  await ensurePasswordResetTable();
  const tokenHash = hashResetToken(token);

  const result = await turso.execute({
    sql: `SELECT id, user_id, token_hash, expires_at, used_at, created_at
          FROM password_reset_tokens
          WHERE token_hash = ?
            AND used_at IS NULL
            AND julianday(expires_at) > julianday('now')
          ORDER BY created_at DESC
          LIMIT 1`,
    args: [tokenHash],
  });

  if (result.rows.length === 0) return null;
  return mapPasswordResetTokenRow(result.rows[0]);
}

export async function markPasswordResetTokenUsed(tokenId: string): Promise<void> {
  await ensurePasswordResetTable();
  await turso.execute({
    sql: `UPDATE password_reset_tokens
          SET used_at = datetime('now')
          WHERE id = ?`,
    args: [tokenId],
  });
}

export async function invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
  await ensurePasswordResetTable();
  await turso.execute({
    sql: `UPDATE password_reset_tokens
          SET used_at = datetime('now')
          WHERE user_id = ? AND used_at IS NULL`,
    args: [userId],
  });
}
