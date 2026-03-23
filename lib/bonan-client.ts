import { turso } from "./turso";

export type BonanEntityType = "bonan_report" | "work_order" | "incident_report";
export type BonanSite = "bonan_towers";
export type BonanChangeRequestStatus =
  | "pending"
  | "grant_approved"
  | "changes_submitted"
  | "applied"
  | "rejected"
  | "expired";

export interface BonanClientMembership {
  id: string;
  site: BonanSite;
  user_id: string;
  company_name: string | null;
  display_name: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

export interface BonanClientInvitation {
  id: string;
  site: BonanSite;
  email: string;
  token: string;
  invited_by: string | null;
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  inviter_name?: string;
}

export interface BonanApproval {
  id: string;
  site: BonanSite;
  entity_type: BonanEntityType;
  entity_id: string;
  approved_revision: number;
  approved_by_user_id: string;
  signer_name: string;
  signature_data: string;
  approval_date: string;
  approved_at: string;
  ip_address: string | null;
  created_at: string;
  approver_name?: string;
  approver_email?: string;
}

export interface BonanChangeRequest {
  id: string;
  site: BonanSite;
  entity_type: BonanEntityType;
  entity_id: string;
  requested_by: string;
  requested_area: string;
  requested_fields: string[];
  message: string | null;
  status: BonanChangeRequestStatus;
  approved_fields: string[];
  grant_expires_at: string | null;
  granted_by: string | null;
  granted_at: string | null;
  final_reviewed_by: string | null;
  final_reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  requester_email?: string;
  reviewer_name?: string;
}

export interface BonanChangeRequestEdit {
  id: string;
  change_request_id: string;
  field_path: string;
  old_value: string | null;
  proposed_value: string | null;
  created_at: string;
}

const SITE: BonanSite = "bonan_towers";

let schemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;

function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  } catch {
    return [];
  }
}

function mapMembership(row: Record<string, unknown>): BonanClientMembership {
  return {
    id: row.id as string,
    site: (row.site as BonanSite) || SITE,
    user_id: row.user_id as string,
    company_name: row.company_name as string | null,
    display_name: row.display_name as string | null,
    is_active: asBoolean(row.is_active),
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    user_name: row.user_name as string | undefined,
    user_email: row.user_email as string | undefined,
  };
}

function mapInvitation(row: Record<string, unknown>): BonanClientInvitation {
  return {
    id: row.id as string,
    site: (row.site as BonanSite) || SITE,
    email: row.email as string,
    token: row.token as string,
    invited_by: row.invited_by as string | null,
    status: row.status as BonanClientInvitation["status"],
    expires_at: row.expires_at as string,
    created_at: row.created_at as string,
    accepted_at: row.accepted_at as string | null,
    inviter_name: row.inviter_name as string | undefined,
  };
}

function mapApproval(row: Record<string, unknown>): BonanApproval {
  return {
    id: row.id as string,
    site: (row.site as BonanSite) || SITE,
    entity_type: row.entity_type as BonanEntityType,
    entity_id: row.entity_id as string,
    approved_revision: Number(row.approved_revision || 1),
    approved_by_user_id: row.approved_by_user_id as string,
    signer_name: row.signer_name as string,
    signature_data: row.signature_data as string,
    approval_date: row.approval_date as string,
    approved_at: row.approved_at as string,
    ip_address: row.ip_address as string | null,
    created_at: row.created_at as string,
    approver_name: row.approver_name as string | undefined,
    approver_email: row.approver_email as string | undefined,
  };
}

function mapChangeRequest(row: Record<string, unknown>): BonanChangeRequest {
  return {
    id: row.id as string,
    site: (row.site as BonanSite) || SITE,
    entity_type: row.entity_type as BonanEntityType,
    entity_id: row.entity_id as string,
    requested_by: row.requested_by as string,
    requested_area: row.requested_area as string,
    requested_fields: parseJsonArray(row.requested_fields_json),
    message: row.message as string | null,
    status: row.status as BonanChangeRequestStatus,
    approved_fields: parseJsonArray(row.approved_fields_json),
    grant_expires_at: row.grant_expires_at as string | null,
    granted_by: row.granted_by as string | null,
    granted_at: row.granted_at as string | null,
    final_reviewed_by: row.final_reviewed_by as string | null,
    final_reviewed_at: row.final_reviewed_at as string | null,
    admin_notes: row.admin_notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    requester_name: row.requester_name as string | undefined,
    requester_email: row.requester_email as string | undefined,
    reviewer_name: row.reviewer_name as string | undefined,
  };
}

function mapChangeRequestEdit(row: Record<string, unknown>): BonanChangeRequestEdit {
  return {
    id: row.id as string,
    change_request_id: row.change_request_id as string,
    field_path: row.field_path as string,
    old_value: row.old_value as string | null,
    proposed_value: row.proposed_value as string | null,
    created_at: row.created_at as string,
  };
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  try {
    await turso.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    const message = String(error).toLowerCase();
    if (!message.includes("duplicate column name")) {
      throw error;
    }
  }
}

export async function ensureBonanClientSchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaReadyPromise) {
    await schemaReadyPromise;
    return;
  }

  schemaReadyPromise = (async () => {
    await addColumnIfMissing("work_orders", "site", "TEXT");
    await addColumnIfMissing("work_orders", "client_visible_revision", "INTEGER NOT NULL DEFAULT 1");
    await addColumnIfMissing("work_orders", "status_note", "TEXT");
    await addColumnIfMissing("work_orders", "status_updated_at", "TEXT");
    await addColumnIfMissing("work_orders", "status_updated_by", "TEXT");
    await addColumnIfMissing("incident_reports", "site", "TEXT");
    await addColumnIfMissing("incident_reports", "client_visible_revision", "INTEGER NOT NULL DEFAULT 1");
    await addColumnIfMissing("incident_reports", "status_note", "TEXT");
    await addColumnIfMissing("incident_reports", "status_updated_at", "TEXT");
    await addColumnIfMissing("incident_reports", "status_updated_by", "TEXT");
    await addColumnIfMissing("bonan_reports", "client_visible_revision", "INTEGER NOT NULL DEFAULT 1");

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS bonan_client_memberships (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        site TEXT NOT NULL DEFAULT 'bonan_towers',
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_name TEXT,
        display_name TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(site, user_id)
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS bonan_client_invitations (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        site TEXT NOT NULL DEFAULT 'bonan_towers',
        email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        accepted_at TEXT
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS bonan_client_approvals (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        site TEXT NOT NULL DEFAULT 'bonan_towers',
        entity_type TEXT NOT NULL CHECK (entity_type IN ('bonan_report', 'work_order', 'incident_report')),
        entity_id TEXT NOT NULL,
        approved_revision INTEGER NOT NULL DEFAULT 1,
        approved_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        signer_name TEXT NOT NULL,
        signature_data TEXT NOT NULL,
        approval_date TEXT NOT NULL,
        approved_at TEXT NOT NULL DEFAULT (datetime('now')),
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(entity_type, entity_id, approved_by_user_id, approved_revision)
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS bonan_change_requests (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        site TEXT NOT NULL DEFAULT 'bonan_towers',
        entity_type TEXT NOT NULL CHECK (entity_type IN ('bonan_report', 'work_order', 'incident_report')),
        entity_id TEXT NOT NULL,
        requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_area TEXT NOT NULL,
        requested_fields_json TEXT NOT NULL,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'grant_approved', 'changes_submitted', 'applied', 'rejected', 'expired')),
        approved_fields_json TEXT,
        grant_expires_at TEXT,
        granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        granted_at TEXT,
        final_reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        final_reviewed_at TEXT,
        admin_notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS bonan_change_request_edits (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        change_request_id TEXT NOT NULL REFERENCES bonan_change_requests(id) ON DELETE CASCADE,
        field_path TEXT NOT NULL,
        old_value TEXT,
        proposed_value TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS material_purchases (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('work_order', 'incident_report')),
        entity_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        description TEXT,
        total_cost REAL NOT NULL DEFAULT 0,
        receipt_filename TEXT NOT NULL,
        receipt_s3_key TEXT,
        receipt_s3_url TEXT,
        purchased_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_client_memberships_user ON bonan_client_memberships(user_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_client_memberships_site ON bonan_client_memberships(site)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_client_invitations_email ON bonan_client_invitations(email)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_client_invitations_status ON bonan_client_invitations(status)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_client_approvals_entity ON bonan_client_approvals(entity_type, entity_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_change_requests_entity ON bonan_change_requests(entity_type, entity_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_change_requests_requester ON bonan_change_requests(requested_by)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_change_requests_status ON bonan_change_requests(status)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_bonan_change_request_edits_request ON bonan_change_request_edits(change_request_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_material_purchases_entity ON material_purchases(entity_type, entity_id)");
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_material_purchases_purchased_by ON material_purchases(purchased_by)");

    await turso.execute(`
      UPDATE work_orders
      SET site = 'bonan_towers'
      WHERE site IS NULL
        AND id IN (
          SELECT work_order_id FROM bonan_reports WHERE work_order_id IS NOT NULL
          UNION
          SELECT work_order_id FROM bonan_report_work_orders
        )
    `);

    await turso.execute(`
      UPDATE incident_reports
      SET site = 'bonan_towers'
      WHERE site IS NULL
        AND bonan_report_id IN (
          SELECT id FROM bonan_reports WHERE site = 'bonan_towers'
        )
    `);

    schemaReady = true;
  })();

  try {
    await schemaReadyPromise;
  } finally {
    schemaReadyPromise = null;
  }
}

export async function getActiveBonanMembershipByUserId(userId: string): Promise<BonanClientMembership | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT bcm.*,
                 u.first_name || ' ' || u.last_name AS user_name,
                 u.email AS user_email
          FROM bonan_client_memberships bcm
          INNER JOIN users u ON u.id = bcm.user_id
          WHERE bcm.user_id = ?
            AND bcm.site = ?
            AND bcm.is_active = 1
          LIMIT 1`,
    args: [userId, SITE],
  });

  if (result.rows.length === 0) return null;
  return mapMembership(result.rows[0]);
}

export async function userHasBonanClientMembership(userId: string): Promise<boolean> {
  return Boolean(await getActiveBonanMembershipByUserId(userId));
}

export async function getBonanClientMemberships(options: {
  userId?: string;
  includeInactive?: boolean;
} = {}): Promise<BonanClientMembership[]> {
  await ensureBonanClientSchema();
  const conditions = ["bcm.site = ?"];
  const args: Array<string | number> = [SITE];

  if (!options.includeInactive) {
    conditions.push("bcm.is_active = 1");
  }
  if (options.userId) {
    conditions.push("bcm.user_id = ?");
    args.push(options.userId);
  }

  const result = await turso.execute({
    sql: `SELECT bcm.*,
                 u.first_name || ' ' || u.last_name AS user_name,
                 u.email AS user_email
          FROM bonan_client_memberships bcm
          INNER JOIN users u ON u.id = bcm.user_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY u.first_name ASC, u.last_name ASC, bcm.created_at DESC`,
    args,
  });

  return result.rows.map(mapMembership);
}

export async function upsertBonanClientMembership(data: {
  user_id: string;
  company_name?: string | null;
  display_name?: string | null;
  created_by?: string | null;
}): Promise<BonanClientMembership> {
  await ensureBonanClientSchema();
  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO bonan_client_memberships (
            id, site, user_id, company_name, display_name, is_active, created_by
          ) VALUES (?, ?, ?, ?, ?, 1, ?)
          ON CONFLICT(site, user_id) DO UPDATE SET
            company_name = excluded.company_name,
            display_name = excluded.display_name,
            is_active = 1,
            updated_at = datetime('now')`,
    args: [id, SITE, data.user_id, data.company_name || null, data.display_name || null, data.created_by || null],
  });

  const membership = await getActiveBonanMembershipByUserId(data.user_id);
  if (!membership) {
    throw new Error("Failed to upsert Bonan client membership");
  }
  return membership;
}

export async function deactivateBonanClientMembership(id: string): Promise<boolean> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `UPDATE bonan_client_memberships
          SET is_active = 0, updated_at = datetime('now')
          WHERE id = ?`,
    args: [id],
  });
  return Number(result.rowsAffected || 0) > 0;
}

export async function getBonanClientInvitations(): Promise<BonanClientInvitation[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT bci.*,
                 u.first_name || ' ' || u.last_name AS inviter_name
          FROM bonan_client_invitations bci
          LEFT JOIN users u ON u.id = bci.invited_by
          WHERE bci.site = ?
          ORDER BY bci.created_at DESC`,
    args: [SITE],
  });
  return result.rows.map(mapInvitation);
}

export async function createBonanClientInvitation(data: {
  email: string;
  invited_by: string;
}): Promise<BonanClientInvitation> {
  await ensureBonanClientSchema();
  const id = crypto.randomUUID().replace(/-/g, "");
  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await turso.execute({
    sql: `INSERT INTO bonan_client_invitations (
            id, site, email, token, invited_by, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, SITE, data.email.toLowerCase(), token, data.invited_by, expiresAt.toISOString()],
  });

  const result = await turso.execute({
    sql: `SELECT bci.*,
                 u.first_name || ' ' || u.last_name AS inviter_name
          FROM bonan_client_invitations bci
          LEFT JOIN users u ON u.id = bci.invited_by
          WHERE bci.id = ?`,
    args: [id],
  });

  return mapInvitation(result.rows[0]);
}

export async function getBonanClientInvitationByToken(token: string): Promise<BonanClientInvitation | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT bci.*,
                 u.first_name || ' ' || u.last_name AS inviter_name
          FROM bonan_client_invitations bci
          LEFT JOIN users u ON u.id = bci.invited_by
          WHERE bci.token = ?`,
    args: [token],
  });

  if (result.rows.length === 0) return null;
  const invitation = mapInvitation(result.rows[0]);
  if (invitation.status === "pending" && new Date(invitation.expires_at) < new Date()) {
    await turso.execute({
      sql: `UPDATE bonan_client_invitations SET status = 'expired' WHERE id = ?`,
      args: [invitation.id],
    });
    invitation.status = "expired";
  }
  return invitation;
}

export async function processPendingBonanInvitationsForUser(email: string, userId: string): Promise<number> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT * FROM bonan_client_invitations
          WHERE site = ?
            AND email = ?
            AND status = 'pending'`,
    args: [SITE, email.toLowerCase()],
  });

  let processed = 0;
  for (const row of result.rows) {
    const invitation = mapInvitation(row);
    if (new Date(invitation.expires_at) < new Date()) {
      await turso.execute({
        sql: `UPDATE bonan_client_invitations SET status = 'expired' WHERE id = ?`,
        args: [invitation.id],
      });
      continue;
    }

    await upsertBonanClientMembership({ user_id: userId });
    await turso.execute({
      sql: `UPDATE bonan_client_invitations
            SET status = 'accepted',
                accepted_at = datetime('now')
            WHERE id = ?`,
      args: [invitation.id],
    });
    processed += 1;
  }

  return processed;
}

export async function getBonanEntityRevision(entityType: BonanEntityType, entityId: string): Promise<number> {
  await ensureBonanClientSchema();
  const config: Record<BonanEntityType, { table: string; column: string }> = {
    bonan_report: { table: "bonan_reports", column: "client_visible_revision" },
    work_order: { table: "work_orders", column: "client_visible_revision" },
    incident_report: { table: "incident_reports", column: "client_visible_revision" },
  };
  const { table, column } = config[entityType];
  const result = await turso.execute({
    sql: `SELECT ${column} AS revision FROM ${table} WHERE id = ?`,
    args: [entityId],
  });
  if (result.rows.length === 0) return 1;
  return Number(result.rows[0].revision || 1);
}

export async function getBonanApprovals(entityType: BonanEntityType, entityId: string): Promise<BonanApproval[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT bca.*,
                 u.first_name || ' ' || u.last_name AS approver_name,
                 u.email AS approver_email
          FROM bonan_client_approvals bca
          LEFT JOIN users u ON u.id = bca.approved_by_user_id
          WHERE bca.site = ?
            AND bca.entity_type = ?
            AND bca.entity_id = ?
          ORDER BY bca.approved_at DESC`,
    args: [SITE, entityType, entityId],
  });
  return result.rows.map(mapApproval);
}

export async function saveBonanApproval(data: {
  entity_type: BonanEntityType;
  entity_id: string;
  approved_by_user_id: string;
  signer_name: string;
  signature_data: string;
  approval_date: string;
  ip_address?: string | null;
}): Promise<BonanApproval> {
  await ensureBonanClientSchema();
  const id = crypto.randomUUID().replace(/-/g, "");
  const revision = await getBonanEntityRevision(data.entity_type, data.entity_id);

  await turso.execute({
    sql: `INSERT INTO bonan_client_approvals (
            id, site, entity_type, entity_id, approved_revision, approved_by_user_id,
            signer_name, signature_data, approval_date, ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(entity_type, entity_id, approved_by_user_id, approved_revision) DO UPDATE SET
            signer_name = excluded.signer_name,
            signature_data = excluded.signature_data,
            approval_date = excluded.approval_date,
            ip_address = excluded.ip_address,
            approved_at = datetime('now')`,
    args: [
      id,
      SITE,
      data.entity_type,
      data.entity_id,
      revision,
      data.approved_by_user_id,
      data.signer_name,
      data.signature_data,
      data.approval_date,
      data.ip_address || null,
    ],
  });

  const approvals = await getBonanApprovals(data.entity_type, data.entity_id);
  const latest = approvals.find(
    (approval) =>
      approval.approved_by_user_id === data.approved_by_user_id &&
      approval.approved_revision === revision
  );
  if (!latest) {
    throw new Error("Failed to save Bonan approval");
  }
  return latest;
}

async function expireChangeRequestIfNeeded(changeRequest: BonanChangeRequest): Promise<BonanChangeRequest> {
  if (
    changeRequest.status === "grant_approved" &&
    changeRequest.grant_expires_at &&
    new Date(changeRequest.grant_expires_at) < new Date()
  ) {
    await turso.execute({
      sql: `UPDATE bonan_change_requests
            SET status = 'expired',
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [changeRequest.id],
    });
    return { ...changeRequest, status: "expired" };
  }
  return changeRequest;
}

export async function getBonanChangeRequestById(id: string): Promise<BonanChangeRequest | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT bcr.*,
                 req.first_name || ' ' || req.last_name AS requester_name,
                 req.email AS requester_email,
                 rev.first_name || ' ' || rev.last_name AS reviewer_name
          FROM bonan_change_requests bcr
          LEFT JOIN users req ON req.id = bcr.requested_by
          LEFT JOIN users rev ON rev.id = COALESCE(bcr.final_reviewed_by, bcr.granted_by)
          WHERE bcr.id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return expireChangeRequestIfNeeded(mapChangeRequest(result.rows[0]));
}

export async function getBonanChangeRequests(filters: {
  requested_by?: string;
  entity_type?: BonanEntityType;
  entity_id?: string;
  status?: BonanChangeRequestStatus;
} = {}): Promise<BonanChangeRequest[]> {
  await ensureBonanClientSchema();
  const conditions = ["bcr.site = ?"];
  const args: Array<string> = [SITE];

  if (filters.requested_by) {
    conditions.push("bcr.requested_by = ?");
    args.push(filters.requested_by);
  }
  if (filters.entity_type) {
    conditions.push("bcr.entity_type = ?");
    args.push(filters.entity_type);
  }
  if (filters.entity_id) {
    conditions.push("bcr.entity_id = ?");
    args.push(filters.entity_id);
  }
  if (filters.status) {
    conditions.push("bcr.status = ?");
    args.push(filters.status);
  }

  const result = await turso.execute({
    sql: `SELECT bcr.*,
                 req.first_name || ' ' || req.last_name AS requester_name,
                 req.email AS requester_email,
                 rev.first_name || ' ' || rev.last_name AS reviewer_name
          FROM bonan_change_requests bcr
          LEFT JOIN users req ON req.id = bcr.requested_by
          LEFT JOIN users rev ON rev.id = COALESCE(bcr.final_reviewed_by, bcr.granted_by)
          WHERE ${conditions.join(" AND ")}
          ORDER BY bcr.created_at DESC`,
    args,
  });

  const requests: BonanChangeRequest[] = [];
  for (const row of result.rows) {
    requests.push(await expireChangeRequestIfNeeded(mapChangeRequest(row)));
  }
  return requests;
}

export async function createBonanChangeRequest(data: {
  entity_type: BonanEntityType;
  entity_id: string;
  requested_by: string;
  requested_area: string;
  requested_fields: string[];
  message?: string | null;
}): Promise<BonanChangeRequest> {
  await ensureBonanClientSchema();
  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO bonan_change_requests (
            id, site, entity_type, entity_id, requested_by, requested_area, requested_fields_json, message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      SITE,
      data.entity_type,
      data.entity_id,
      data.requested_by,
      data.requested_area,
      JSON.stringify(data.requested_fields),
      data.message || null,
    ],
  });

  const request = await getBonanChangeRequestById(id);
  if (!request) {
    throw new Error("Failed to create Bonan change request");
  }
  return request;
}

export async function grantBonanChangeRequest(id: string, data: {
  approved_fields: string[];
  grant_expires_at: string | null;
  admin_notes?: string | null;
  granted_by: string;
}): Promise<BonanChangeRequest | null> {
  await ensureBonanClientSchema();
  await turso.execute({
    sql: `UPDATE bonan_change_requests
          SET status = 'grant_approved',
              approved_fields_json = ?,
              grant_expires_at = ?,
              admin_notes = ?,
              granted_by = ?,
              granted_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      JSON.stringify(data.approved_fields),
      data.grant_expires_at,
      data.admin_notes || null,
      data.granted_by,
      id,
    ],
  });
  return getBonanChangeRequestById(id);
}

export async function rejectBonanChangeRequest(id: string, data: {
  admin_notes?: string | null;
  reviewer_id: string;
}): Promise<BonanChangeRequest | null> {
  await ensureBonanClientSchema();
  await turso.execute({
    sql: `UPDATE bonan_change_requests
          SET status = 'rejected',
              admin_notes = ?,
              final_reviewed_by = ?,
              final_reviewed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [data.admin_notes || null, data.reviewer_id, id],
  });
  return getBonanChangeRequestById(id);
}

export async function getBonanChangeRequestEdits(changeRequestId: string): Promise<BonanChangeRequestEdit[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT * FROM bonan_change_request_edits
          WHERE change_request_id = ?
          ORDER BY created_at ASC`,
    args: [changeRequestId],
  });
  return result.rows.map(mapChangeRequestEdit);
}

export async function submitBonanChangeRequestEdits(data: {
  change_request_id: string;
  requester_id: string;
  edits: Array<{ field_path: string; old_value?: string | null; proposed_value?: string | null }>;
}): Promise<BonanChangeRequest | null> {
  await ensureBonanClientSchema();
  const changeRequest = await getBonanChangeRequestById(data.change_request_id);
  if (!changeRequest) return null;
  if (changeRequest.requested_by !== data.requester_id) {
    throw new Error("Only the requester can submit approved Bonan edits.");
  }
  if (changeRequest.status !== "grant_approved") {
    throw new Error("This Bonan change request is not approved for edits.");
  }
  if (changeRequest.grant_expires_at && new Date(changeRequest.grant_expires_at) < new Date()) {
    await turso.execute({
      sql: `UPDATE bonan_change_requests
            SET status = 'expired', updated_at = datetime('now')
            WHERE id = ?`,
      args: [data.change_request_id],
    });
    throw new Error("This Bonan edit grant has expired.");
  }

  await turso.execute({
    sql: `DELETE FROM bonan_change_request_edits WHERE change_request_id = ?`,
    args: [data.change_request_id],
  });

  for (const edit of data.edits) {
    await turso.execute({
      sql: `INSERT INTO bonan_change_request_edits (
              id, change_request_id, field_path, old_value, proposed_value
            ) VALUES (?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID().replace(/-/g, ""),
        data.change_request_id,
        edit.field_path,
        edit.old_value || null,
        edit.proposed_value || null,
      ],
    });
  }

  await turso.execute({
    sql: `UPDATE bonan_change_requests
          SET status = 'changes_submitted',
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [data.change_request_id],
  });

  return getBonanChangeRequestById(data.change_request_id);
}

export async function finalizeBonanChangeRequest(data: {
  id: string;
  status: "applied" | "rejected";
  reviewer_id: string;
  admin_notes?: string | null;
}): Promise<BonanChangeRequest | null> {
  await ensureBonanClientSchema();
  await turso.execute({
    sql: `UPDATE bonan_change_requests
          SET status = ?,
              admin_notes = ?,
              final_reviewed_by = ?,
              final_reviewed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [data.status, data.admin_notes || null, data.reviewer_id, data.id],
  });
  return getBonanChangeRequestById(data.id);
}

export async function getPublishedBonanWorkOrders(): Promise<Record<string, unknown>[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute(`
    SELECT wo.*
    FROM work_orders wo
    WHERE wo.site = 'bonan_towers'
      AND wo.publication_status = 'published'
    ORDER BY wo.date DESC, wo.created_at DESC
  `);
  return result.rows as Record<string, unknown>[];
}

export async function getPublishedBonanWorkOrderById(id: string): Promise<Record<string, unknown> | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT * FROM work_orders
          WHERE id = ?
            AND site = 'bonan_towers'
            AND publication_status = 'published'`,
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as Record<string, unknown>) : null;
}

export async function getPublishedBonanIncidentReports(): Promise<Record<string, unknown>[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute(`
    SELECT ir.*
    FROM incident_reports ir
    WHERE ir.site = 'bonan_towers'
      AND ir.publication_status = 'published'
    ORDER BY ir.report_date DESC, ir.created_at DESC
  `);
  return result.rows as Record<string, unknown>[];
}

export async function getPublishedBonanIncidentReportById(id: string): Promise<Record<string, unknown> | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT * FROM incident_reports
          WHERE id = ?
            AND site = 'bonan_towers'
            AND publication_status = 'published'`,
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as Record<string, unknown>) : null;
}
