import { turso } from "./turso";

export interface EmployeeInvitation {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  token: string;
  invited_by: string | null;
  inviter_name?: string;
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
}

let employeeTablesReady = false;
let employeeTablesReadyPromise: Promise<void> | null = null;

async function ensureEmployeeTables(): Promise<void> {
  if (employeeTablesReady) return;
  if (employeeTablesReadyPromise) {
    await employeeTablesReadyPromise;
    return;
  }

  employeeTablesReadyPromise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS employee_invitations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        accepted_at TEXT,
        accepted_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(token)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status)"
    );

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS employee_onboarding (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        completed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    employeeTablesReady = true;
  })();

  try {
    await employeeTablesReadyPromise;
  } finally {
    employeeTablesReadyPromise = null;
  }
}

function mapRowToEmployeeInvitation(row: Record<string, unknown>): EmployeeInvitation {
  return {
    id: row.id as string,
    email: row.email as string,
    first_name: row.first_name as string | null,
    last_name: row.last_name as string | null,
    token: row.token as string,
    invited_by: row.invited_by as string | null,
    inviter_name: row.inviter_name as string | undefined,
    status: row.status as EmployeeInvitation["status"],
    expires_at: row.expires_at as string,
    created_at: row.created_at as string,
    accepted_at: row.accepted_at as string | null,
    accepted_user_id: row.accepted_user_id as string | null,
  };
}

export async function getEmployeeInvitations(
  status?: EmployeeInvitation["status"]
): Promise<EmployeeInvitation[]> {
  await ensureEmployeeTables();
  const hasStatus = Boolean(status);
  const result = await turso.execute({
    sql: `SELECT ei.*, u.first_name || ' ' || u.last_name as inviter_name
          FROM employee_invitations ei
          LEFT JOIN users u ON ei.invited_by = u.id
          ${hasStatus ? "WHERE ei.status = ?" : ""}
          ORDER BY ei.created_at DESC`,
    args: hasStatus ? [status!] : [],
  });
  return result.rows.map(mapRowToEmployeeInvitation);
}

export async function getEmployeeInvitationByToken(
  token: string
): Promise<EmployeeInvitation | null> {
  await ensureEmployeeTables();
  const result = await turso.execute({
    sql: `SELECT ei.*, u.first_name || ' ' || u.last_name as inviter_name
          FROM employee_invitations ei
          LEFT JOIN users u ON ei.invited_by = u.id
          WHERE ei.token = ?`,
    args: [token],
  });

  if (result.rows.length === 0) return null;
  return mapRowToEmployeeInvitation(result.rows[0]);
}

export async function createEmployeeInvitation(data: {
  email: string;
  first_name?: string;
  last_name?: string;
  invited_by: string;
}): Promise<EmployeeInvitation> {
  await ensureEmployeeTables();
  const id = crypto.randomUUID().replace(/-/g, "");
  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await turso.execute({
    sql: `INSERT INTO employee_invitations
          (id, email, first_name, last_name, token, invited_by, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.email.toLowerCase(),
      data.first_name || null,
      data.last_name || null,
      token,
      data.invited_by,
      expiresAt.toISOString(),
    ],
  });

  return (await getEmployeeInvitationByToken(token))!;
}

export async function acceptEmployeeInvitation(
  token: string,
  userId: string
): Promise<boolean> {
  await ensureEmployeeTables();
  const invitation = await getEmployeeInvitationByToken(token);
  if (!invitation || invitation.status !== "pending") return false;

  if (new Date(invitation.expires_at) < new Date()) {
    await turso.execute({
      sql: "UPDATE employee_invitations SET status = 'expired' WHERE id = ?",
      args: [invitation.id],
    });
    return false;
  }

  await turso.execute({
    sql: `UPDATE employee_invitations
          SET status = 'accepted',
              accepted_at = datetime('now'),
              accepted_user_id = ?
          WHERE id = ?`,
    args: [userId, invitation.id],
  });

  return true;
}

export async function getEmployeeOnboardingStatus(
  userId: string
): Promise<{ completed: boolean; completed_at: string | null }> {
  await ensureEmployeeTables();
  const result = await turso.execute({
    sql: "SELECT completed_at FROM employee_onboarding WHERE user_id = ?",
    args: [userId],
  });

  if (result.rows.length === 0) {
    return { completed: false, completed_at: null };
  }

  return {
    completed: true,
    completed_at: result.rows[0].completed_at as string,
  };
}

export async function completeEmployeeOnboarding(
  userId: string
): Promise<{ completed: boolean; completed_at: string | null }> {
  await ensureEmployeeTables();
  await turso.execute({
    sql: `INSERT INTO employee_onboarding (user_id, completed_at)
          VALUES (?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET completed_at = datetime('now')`,
    args: [userId],
  });

  return getEmployeeOnboardingStatus(userId);
}
