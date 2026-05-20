import { turso } from "./turso";
export { resolveClientAddresses } from "./client-addresses";

export interface CrmClient {
  id: string;
  email: string;
  full_name: string;
  address: string | null;
  service_address: string | null;
  billing_address: string | null;
  user_id: string | null;
  invitation_token: string | null;
  invitation_status: "none" | "pending" | "accepted" | "expired";
  invitation_expires_at: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmClientInput {
  email: string;
  full_name: string;
  address?: string;
  service_address?: string;
  billing_address?: string;
}

let crmClientsTableReady = false;
let crmClientsTableReadyPromise: Promise<void> | null = null;

export async function ensureCrmClientsTable(): Promise<void> {
  if (crmClientsTableReady) return;
  if (crmClientsTableReadyPromise) {
    await crmClientsTableReadyPromise;
    return;
  }

  crmClientsTableReadyPromise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS crm_clients (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        address TEXT,
        service_address TEXT,
        billing_address TEXT,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        invitation_token TEXT,
        invitation_status TEXT NOT NULL DEFAULT 'none'
          CHECK (invitation_status IN ('none', 'pending', 'accepted', 'expired')),
        invitation_expires_at TEXT,
        invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_crm_clients_email ON crm_clients(email)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_crm_clients_user ON crm_clients(user_id)"
    );
    try {
      await turso.execute(
        "ALTER TABLE project_invitations ADD COLUMN crm_client_id TEXT REFERENCES crm_clients(id) ON DELETE SET NULL"
      );
    } catch {
      // column exists
    }
    crmClientsTableReady = true;
  })();

  try {
    await crmClientsTableReadyPromise;
  } finally {
    crmClientsTableReadyPromise = null;
  }
}

function mapRow(row: Record<string, unknown>): CrmClient {
  return {
    id: row.id as string,
    email: row.email as string,
    full_name: row.full_name as string,
    address: (row.address as string | null) || null,
    service_address: (row.service_address as string | null) || null,
    billing_address: (row.billing_address as string | null) || null,
    user_id: (row.user_id as string | null) || null,
    invitation_token: (row.invitation_token as string | null) || null,
    invitation_status:
      (row.invitation_status as CrmClient["invitation_status"]) || "none",
    invitation_expires_at: (row.invitation_expires_at as string | null) || null,
    invited_by: (row.invited_by as string | null) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function listCrmClients(): Promise<CrmClient[]> {
  await ensureCrmClientsTable();
  const result = await turso.execute({
    sql: `SELECT * FROM crm_clients ORDER BY full_name COLLATE NOCASE ASC`,
  });
  return result.rows.map(mapRow);
}

export async function getCrmClientById(id: string): Promise<CrmClient | null> {
  await ensureCrmClientsTable();
  const result = await turso.execute({
    sql: `SELECT * FROM crm_clients WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function getCrmClientByEmail(email: string): Promise<CrmClient | null> {
  await ensureCrmClientsTable();
  const result = await turso.execute({
    sql: `SELECT * FROM crm_clients WHERE lower(email) = lower(?)`,
    args: [email.trim()],
  });
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function getCrmClientByUserId(userId: string): Promise<CrmClient | null> {
  await ensureCrmClientsTable();
  const result = await turso.execute({
    sql: `SELECT * FROM crm_clients WHERE user_id = ?`,
    args: [userId],
  });
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function getCrmClientByInvitationToken(
  token: string
): Promise<CrmClient | null> {
  await ensureCrmClientsTable();
  const result = await turso.execute({
    sql: `SELECT * FROM crm_clients WHERE invitation_token = ?`,
    args: [token],
  });
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function upsertCrmClient(
  data: CrmClientInput & { user_id?: string | null }
): Promise<CrmClient> {
  await ensureCrmClientsTable();
  const email = data.email.trim().toLowerCase();
  const existing = await getCrmClientByEmail(email);

  if (existing) {
    await turso.execute({
      sql: `UPDATE crm_clients SET
            full_name = ?, address = ?, service_address = ?, billing_address = ?,
            user_id = COALESCE(?, user_id), updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        data.full_name.trim(),
        data.address?.trim() || null,
        data.service_address?.trim() || null,
        data.billing_address?.trim() || null,
        data.user_id ?? null,
        existing.id,
      ],
    });
    return (await getCrmClientById(existing.id))!;
  }

  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO crm_clients
          (id, email, full_name, address, service_address, billing_address, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      email,
      data.full_name.trim(),
      data.address?.trim() || null,
      data.service_address?.trim() || null,
      data.billing_address?.trim() || null,
      data.user_id ?? null,
    ],
  });
  return (await getCrmClientById(id))!;
}

export async function updateCrmClient(
  id: string,
  data: Partial<CrmClientInput>
): Promise<CrmClient | null> {
  await ensureCrmClientsTable();
  const existing = await getCrmClientById(id);
  if (!existing) return null;

  await turso.execute({
    sql: `UPDATE crm_clients SET
          full_name = COALESCE(?, full_name),
          address = COALESCE(?, address),
          service_address = COALESCE(?, service_address),
          billing_address = COALESCE(?, billing_address),
          updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      data.full_name?.trim() ?? existing.full_name,
      data.address !== undefined ? data.address?.trim() || null : existing.address,
      data.service_address !== undefined
        ? data.service_address?.trim() || null
        : existing.service_address,
      data.billing_address !== undefined
        ? data.billing_address?.trim() || null
        : existing.billing_address,
      id,
    ],
  });
  return getCrmClientById(id);
}

export async function createCrmClientPortalInvite(
  clientId: string,
  invitedBy: string
): Promise<CrmClient | null> {
  await ensureCrmClientsTable();
  const client = await getCrmClientById(clientId);
  if (!client) return null;

  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await turso.execute({
    sql: `UPDATE crm_clients SET
          invitation_token = ?, invitation_status = 'pending',
          invitation_expires_at = ?, invited_by = ?, updated_at = datetime('now')
          WHERE id = ?`,
    args: [token, expiresAt.toISOString(), invitedBy, clientId],
  });

  return getCrmClientById(clientId);
}

export async function acceptCrmClientInvitation(
  token: string,
  userId: string
): Promise<boolean> {
  const client = await getCrmClientByInvitationToken(token);
  if (!client || client.invitation_status !== "pending") return false;

  if (
    client.invitation_expires_at &&
    new Date(client.invitation_expires_at) < new Date()
  ) {
    await turso.execute({
      sql: `UPDATE crm_clients SET invitation_status = 'expired' WHERE id = ?`,
      args: [client.id],
    });
    return false;
  }

  await turso.execute({
    sql: `UPDATE crm_clients SET
          user_id = ?, invitation_status = 'accepted', updated_at = datetime('now')
          WHERE id = ?`,
    args: [userId, client.id],
  });
  return true;
}

export async function linkCrmClientOnRegistration(
  email: string,
  userId: string,
  fullName: string
): Promise<void> {
  await ensureCrmClientsTable();
  const existing = await getCrmClientByEmail(email);
  if (existing) {
    await turso.execute({
      sql: `UPDATE crm_clients SET user_id = ?, invitation_status = 'accepted', updated_at = datetime('now') WHERE id = ?`,
      args: [userId, existing.id],
    });
    return;
  }

  await upsertCrmClient({
    email,
    full_name: fullName,
    user_id: userId,
  });
}

export async function getEstimateClientDisplayForEmail(email: string): Promise<{
  clientName: string;
  billingAddress: string | null;
  serviceAddress: string | null;
}> {
  const client = await getCrmClientByEmail(email);
  if (!client) {
    return { clientName: email, billingAddress: null, serviceAddress: null };
  }
  return {
    clientName: client.full_name,
    billingAddress: client.billing_address || client.address,
    serviceAddress: client.service_address || client.address,
  };
}

export async function syncCrmClientFromUser(user: {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}): Promise<CrmClient> {
  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.email;
  return upsertCrmClient({
    email: user.email,
    full_name: fullName,
    user_id: user.id,
  });
}
