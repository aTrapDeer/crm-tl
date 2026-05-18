import { turso } from "./turso";
import {
  DEFAULT_ESTIMATE_SETTINGS,
  DEFAULT_INSTALLMENT_SCHEDULE,
  type EstimateSettingsInput,
  parseInstallmentSchedule,
} from "./estimate";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "planning" | "in_progress" | "on_hold" | "completed";
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  hide_line_item_prices_for_client: boolean;
  hide_markup_for_client: boolean;
  is_funded: boolean;
  funding_notes: string | null;
  on_hold_reason: string | null;
  expected_resume_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  token: string;
  invited_by: string | null;
  inviter_name?: string;
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  sort_order: number;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  user_id: string | null;
  title: string;
  content: string | null;
  created_at: string;
  user_name?: string;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  filename: string;
  s3_key: string | null;
  s3_url: string | null;
  caption: string | null;
  uploaded_by: string | null;
  uploader_name?: string;
  created_at: string;
}

export interface ProjectSignature {
  id: string;
  project_id: string;
  signer_role: "admin" | "client";
  signer_name: string;
  signature_data: string;
  signed_by: string | null;
  ip_address: string | null;
  signed_at: string;
  created_at: string;
}

function normalizeVisibleRole(role: unknown): string {
  return role === "worker" ? "employee" : String(role || "");
}

function mapRowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    status: row.status as Project["status"],
    address: row.address as string | null,
    start_date: row.start_date as string | null,
    end_date: row.end_date as string | null,
    budget_amount: row.budget_amount as number | null,
    hide_line_item_prices_for_client: Boolean(row.hide_line_item_prices_for_client),
    hide_markup_for_client: Boolean(row.hide_markup_for_client),
    is_funded: Boolean(row.is_funded),
    funding_notes: row.funding_notes as string | null,
    on_hold_reason: row.on_hold_reason as string | null,
    expected_resume_date: row.expected_resume_date as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getAllProjects(): Promise<Project[]> {
  await ensureProjectClientVisibilityColumns();
  const result = await turso.execute(
    "SELECT * FROM projects ORDER BY created_at DESC"
  );
  return result.rows.map(mapRowToProject);
}

export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  await ensureProjectClientVisibilityColumns();
  const result = await turso.execute({
    sql: `SELECT p.* FROM projects p 
          INNER JOIN project_assignments pa ON p.id = pa.project_id 
          WHERE pa.user_id = ? 
          ORDER BY p.created_at DESC`,
    args: [userId],
  });
  return result.rows.map(mapRowToProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  await ensureProjectClientVisibilityColumns();
  const result = await turso.execute({
    sql: "SELECT * FROM projects WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return mapRowToProject(result.rows[0]);
}

function mapRowToProjectSignature(row: Record<string, unknown>): ProjectSignature {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    signer_role: row.signer_role as ProjectSignature["signer_role"],
    signer_name: row.signer_name as string,
    signature_data: row.signature_data as string,
    signed_by: row.signed_by as string | null,
    ip_address: row.ip_address as string | null,
    signed_at: row.signed_at as string,
    created_at: row.created_at as string,
  };
}

let projectSignaturesTableReady = false;
let projectClientVisibilityColumnsReady = false;
let projectClientVisibilityColumnsReadyPromise: Promise<void> | null = null;
let estimateCustomEntriesTableReady = false;
let estimateCustomEntriesTableReadyPromise: Promise<void> | null = null;

async function ensureProjectClientVisibilityColumns(): Promise<void> {
  if (projectClientVisibilityColumnsReady) return;
  if (projectClientVisibilityColumnsReadyPromise) {
    await projectClientVisibilityColumnsReadyPromise;
    return;
  }

  projectClientVisibilityColumnsReadyPromise = (async () => {
    try {
      await turso.execute(
        "ALTER TABLE projects ADD COLUMN hide_line_item_prices_for_client INTEGER NOT NULL DEFAULT 0"
      );
    } catch (error) {
      const message = String(error).toLowerCase();
      if (!message.includes("duplicate column name")) {
        throw error;
      }
    }

    try {
      await turso.execute(
        "ALTER TABLE projects ADD COLUMN hide_markup_for_client INTEGER NOT NULL DEFAULT 0"
      );
    } catch (error) {
      const message = String(error).toLowerCase();
      if (!message.includes("duplicate column name")) {
        throw error;
      }
    }

    projectClientVisibilityColumnsReady = true;
  })();

  try {
    await projectClientVisibilityColumnsReadyPromise;
  } finally {
    projectClientVisibilityColumnsReadyPromise = null;
  }
}

async function ensureProjectSignaturesTable(): Promise<void> {
  if (projectSignaturesTableReady) return;

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS project_signatures (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      signer_role TEXT NOT NULL CHECK (signer_role IN ('admin', 'client')),
      signer_name TEXT NOT NULL,
      signature_data TEXT NOT NULL,
      signed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      ip_address TEXT,
      signed_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, signer_role)
    )
  `);

  await turso.execute(
    "CREATE INDEX IF NOT EXISTS idx_project_signatures_project ON project_signatures(project_id)"
  );

  projectSignaturesTableReady = true;
}

async function ensureEstimateCustomEntriesTable(): Promise<void> {
  if (estimateCustomEntriesTableReady) return;
  if (estimateCustomEntriesTableReadyPromise) {
    await estimateCustomEntriesTableReadyPromise;
    return;
  }

  estimateCustomEntriesTableReadyPromise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS estimate_custom_entries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        description TEXT,
        default_price_rate REAL NOT NULL DEFAULT 0,
        default_quantity REAL NOT NULL DEFAULT 1,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_custom_entries_name_unique ON estimate_custom_entries(lower(name))"
    );

    estimateCustomEntriesTableReady = true;
  })();

  try {
    await estimateCustomEntriesTableReadyPromise;
  } finally {
    estimateCustomEntriesTableReadyPromise = null;
  }
}

export async function deleteProjectById(id: string): Promise<boolean> {
  const existing = await getProjectById(id);
  if (!existing) return false;

  await turso.execute({
    sql: "DELETE FROM projects WHERE id = ?",
    args: [id],
  });

  return true;
}

export async function createProject(data: {
  name: string;
  description?: string;
  status?: Project["status"];
  address?: string;
  start_date?: string;
  end_date?: string;
  budget_amount?: number;
  is_funded?: boolean;
  hide_line_item_prices_for_client?: boolean;
  hide_markup_for_client?: boolean;
  funding_notes?: string;
  on_hold_reason?: string;
  expected_resume_date?: string;
}): Promise<Project> {
  await ensureProjectClientVisibilityColumns();
  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO projects (id, name, description, status, address, start_date, end_date, budget_amount, is_funded, funding_notes, on_hold_reason, expected_resume_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.name,
      data.description || null,
      data.status || "planning",
      data.address || null,
      data.start_date || null,
      data.end_date || null,
      data.budget_amount || null,
      data.is_funded ? 1 : 0,
      data.funding_notes || null,
      data.on_hold_reason || null,
      data.expected_resume_date || null,
    ],
  });
  return (await getProjectById(id))!;
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, "id" | "created_at">>
): Promise<Project | null> {
  await ensureProjectClientVisibilityColumns();
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    args.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    args.push(data.description);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    args.push(data.status);
  }
  if (data.address !== undefined) {
    updates.push("address = ?");
    args.push(data.address);
  }
  if (data.start_date !== undefined) {
    updates.push("start_date = ?");
    args.push(data.start_date);
  }
  if (data.end_date !== undefined) {
    updates.push("end_date = ?");
    args.push(data.end_date);
  }
  if (data.budget_amount !== undefined) {
    updates.push("budget_amount = ?");
    args.push(data.budget_amount);
  }
  if (data.hide_line_item_prices_for_client !== undefined) {
    updates.push("hide_line_item_prices_for_client = ?");
    args.push(data.hide_line_item_prices_for_client ? 1 : 0);
  }
  if (data.hide_markup_for_client !== undefined) {
    updates.push("hide_markup_for_client = ?");
    args.push(data.hide_markup_for_client ? 1 : 0);
  }
  if (data.is_funded !== undefined) {
    updates.push("is_funded = ?");
    args.push(data.is_funded ? 1 : 0);
  }
  if (data.funding_notes !== undefined) {
    updates.push("funding_notes = ?");
    args.push(data.funding_notes);
  }
  if (data.on_hold_reason !== undefined) {
    updates.push("on_hold_reason = ?");
    args.push(data.on_hold_reason);
  }
  if (data.expected_resume_date !== undefined) {
    updates.push("expected_resume_date = ?");
    args.push(data.expected_resume_date);
  }

  if (updates.length === 0) return getProjectById(id);

  updates.push("updated_at = datetime('now')");
  args.push(id);

  await turso.execute({
    sql: `UPDATE projects SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  return getProjectById(id);
}

export async function assignUserToProject(
  projectId: string,
  userId: string
): Promise<void> {
  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT OR IGNORE INTO project_assignments (id, project_id, user_id) VALUES (?, ?, ?)`,
    args: [id, projectId, userId],
  });
}

export async function unassignUserFromProject(
  projectId: string,
  userId: string
): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM project_assignments WHERE project_id = ? AND user_id = ?`,
    args: [projectId, userId],
  });
}

export async function getProjectAssignments(
  projectId: string
): Promise<{ user_id: string; email: string; first_name: string; last_name: string; role: string }[]> {
  const result = await turso.execute({
    sql: `SELECT u.id as user_id, u.email, u.first_name, u.last_name, u.role 
          FROM users u 
          INNER JOIN project_assignments pa ON u.id = pa.user_id 
          WHERE pa.project_id = ?`,
    args: [projectId],
  });
  return result.rows.map((row) => ({
    user_id: row.user_id as string,
    email: row.email as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    role: normalizeVisibleRole(row.role),
  }));
}

export async function addProjectUpdate(
  projectId: string,
  userId: string,
  title: string,
  content?: string
): Promise<ProjectUpdate> {
  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO project_updates (id, project_id, user_id, title, content) VALUES (?, ?, ?, ?, ?)`,
    args: [id, projectId, userId, title, content || null],
  });

  const result = await turso.execute({
    sql: `SELECT pu.*, u.first_name || ' ' || u.last_name as user_name
          FROM project_updates pu
          LEFT JOIN users u ON pu.user_id = u.id
          WHERE pu.id = ?`,
    args: [id],
  });

  const row = result.rows[0];
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string | null,
    title: row.title as string,
    content: row.content as string | null,
    created_at: row.created_at as string,
    user_name: row.user_name as string | undefined,
  };
}

export async function getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  const result = await turso.execute({
    sql: `SELECT pu.*, u.first_name || ' ' || u.last_name as user_name 
          FROM project_updates pu 
          LEFT JOIN users u ON pu.user_id = u.id 
          WHERE pu.project_id = ? 
          ORDER BY pu.created_at DESC`,
    args: [projectId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    project_id: row.project_id as string,
    user_id: row.user_id as string | null,
    title: row.title as string,
    content: row.content as string | null,
    created_at: row.created_at as string,
    user_name: row.user_name as string | undefined,
  }));
}

export async function getAllUsers(): Promise<{
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}[]> {
  const result = await turso.execute(
    "SELECT id, email, first_name, last_name, role FROM users ORDER BY created_at DESC"
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    role: normalizeVisibleRole(row.role),
  }));
}

// ============ TASK FUNCTIONS ============

function mapRowToTask(row: Record<string, unknown>): ProjectTask {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    title: row.title as string,
    description: row.description as string | null,
    is_completed: Boolean(row.is_completed),
    sort_order: row.sort_order as number,
    created_by: row.created_by as string | null,
    completed_by: row.completed_by as string | null,
    completed_at: row.completed_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getProjectTasks(projectId: string): Promise<ProjectTask[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM project_tasks WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC`,
    args: [projectId],
  });
  return result.rows.map(mapRowToTask);
}

export async function createProjectTask(data: {
  project_id: string;
  title: string;
  description?: string;
  created_by?: string;
}): Promise<ProjectTask> {
  const id = crypto.randomUUID().replace(/-/g, "");
  
  // Get max sort_order for this project
  const maxResult = await turso.execute({
    sql: `SELECT MAX(sort_order) as max_order FROM project_tasks WHERE project_id = ?`,
    args: [data.project_id],
  });
  const maxOrder = (maxResult.rows[0]?.max_order as number) || 0;
  
  await turso.execute({
    sql: `INSERT INTO project_tasks (id, project_id, title, description, sort_order, created_by) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.project_id,
      data.title,
      data.description || null,
      maxOrder + 1,
      data.created_by || null,
    ],
  });
  
  const result = await turso.execute({
    sql: `SELECT * FROM project_tasks WHERE id = ?`,
    args: [id],
  });
  return mapRowToTask(result.rows[0]);
}

export async function updateProjectTask(
  taskId: string,
  data: Partial<Pick<ProjectTask, "title" | "description" | "is_completed" | "sort_order">>,
  completedBy?: string
): Promise<ProjectTask | null> {
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.title !== undefined) {
    updates.push("title = ?");
    args.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    args.push(data.description);
  }
  if (data.sort_order !== undefined) {
    updates.push("sort_order = ?");
    args.push(data.sort_order);
  }
  if (data.is_completed !== undefined) {
    updates.push("is_completed = ?");
    args.push(data.is_completed ? 1 : 0);
    if (data.is_completed) {
      updates.push("completed_at = datetime('now')");
      updates.push("completed_by = ?");
      args.push(completedBy || null);
    } else {
      updates.push("completed_at = NULL");
      updates.push("completed_by = NULL");
    }
  }

  if (updates.length === 0) {
    const result = await turso.execute({
      sql: `SELECT * FROM project_tasks WHERE id = ?`,
      args: [taskId],
    });
    return result.rows.length > 0 ? mapRowToTask(result.rows[0]) : null;
  }

  updates.push("updated_at = datetime('now')");
  args.push(taskId);

  await turso.execute({
    sql: `UPDATE project_tasks SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  const result = await turso.execute({
    sql: `SELECT * FROM project_tasks WHERE id = ?`,
    args: [taskId],
  });
  return result.rows.length > 0 ? mapRowToTask(result.rows[0]) : null;
}

export async function deleteProjectTask(taskId: string): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM project_tasks WHERE id = ?`,
    args: [taskId],
  });
}

export async function getProjectTaskStats(projectId: string): Promise<{ total: number; completed: number }> {
  const result = await turso.execute({
    sql: `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
          FROM project_tasks 
          WHERE project_id = ?`,
    args: [projectId],
  });
  const row = result.rows[0];
  return {
    total: (row.total as number) || 0,
    completed: (row.completed as number) || 0,
  };
}

// Get assignments visible to non-admins (excludes admin users)
export async function getProjectAssignmentsPublic(
  projectId: string
): Promise<{ user_id: string; first_name: string; last_name: string; role: string }[]> {
  const result = await turso.execute({
    sql: `SELECT u.id as user_id, u.first_name, u.last_name, u.role 
          FROM users u 
          INNER JOIN project_assignments pa ON u.id = pa.user_id 
          WHERE pa.project_id = ? AND u.role IN ('employee', 'worker')`,
    args: [projectId],
  });
  return result.rows.map((row) => ({
    user_id: row.user_id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    role: normalizeVisibleRole(row.role),
  }));
}

// ============ PROJECT SIGNATURES ============

export async function getProjectSignatures(projectId: string): Promise<ProjectSignature[]> {
  await ensureProjectSignaturesTable();
  const result = await turso.execute({
    sql: `SELECT * FROM project_signatures
          WHERE project_id = ?
          ORDER BY created_at ASC`,
    args: [projectId],
  });
  return result.rows.map(mapRowToProjectSignature);
}

export async function upsertProjectSignature(data: {
  project_id: string;
  signer_role: ProjectSignature["signer_role"];
  signer_name: string;
  signature_data: string;
  signed_by?: string;
  ip_address?: string;
}): Promise<ProjectSignature> {
  await ensureProjectSignaturesTable();
  await turso.execute({
    sql: `DELETE FROM project_signatures
          WHERE project_id = ? AND signer_role = ?`,
    args: [data.project_id, data.signer_role],
  });

  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO project_signatures
          (id, project_id, signer_role, signer_name, signature_data, signed_by, ip_address, signed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      id,
      data.project_id,
      data.signer_role,
      data.signer_name,
      data.signature_data,
      data.signed_by || null,
      data.ip_address || null,
    ],
  });

  const result = await turso.execute({
    sql: "SELECT * FROM project_signatures WHERE id = ?",
    args: [id],
  });

  return mapRowToProjectSignature(result.rows[0]);
}

export async function clearProjectSignatures(projectId: string): Promise<void> {
  await ensureProjectSignaturesTable();
  await turso.execute({
    sql: "DELETE FROM project_signatures WHERE project_id = ?",
    args: [projectId],
  });
}

// ============ ESTIMATE LINE ITEMS ============

export interface EstimateCustomEntry {
  id: string;
  name: string;
  description: string | null;
  default_price_rate: number;
  default_quantity: number;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

function mapRowToEstimateCustomEntry(
  row: Record<string, unknown>
): EstimateCustomEntry {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    default_price_rate: (row.default_price_rate as number) || 0,
    default_quantity: (row.default_quantity as number) || 1,
    created_by: row.created_by as string | null,
    created_by_name: row.created_by_name as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getEstimateCustomEntries(): Promise<EstimateCustomEntry[]> {
  await ensureEstimateCustomEntriesTable();
  const result = await turso.execute({
    sql: `SELECT ece.*, u.first_name || ' ' || u.last_name as created_by_name
          FROM estimate_custom_entries ece
          LEFT JOIN users u ON ece.created_by = u.id
          ORDER BY ece.name COLLATE NOCASE ASC`,
  });

  return result.rows.map(mapRowToEstimateCustomEntry);
}

export async function createEstimateCustomEntry(data: {
  name: string;
  description?: string;
  default_price_rate?: number;
  default_quantity?: number;
  created_by?: string;
}): Promise<EstimateCustomEntry> {
  await ensureEstimateCustomEntriesTable();
  const normalizedName = data.name.trim();

  const existing = await turso.execute({
    sql: `SELECT ece.*, u.first_name || ' ' || u.last_name as created_by_name
          FROM estimate_custom_entries ece
          LEFT JOIN users u ON ece.created_by = u.id
          WHERE lower(ece.name) = lower(?)
          LIMIT 1`,
    args: [normalizedName],
  });

  if (existing.rows.length > 0) {
    const existingId = existing.rows[0].id as string;
    await turso.execute({
      sql: `UPDATE estimate_custom_entries
            SET description = ?,
                default_price_rate = ?,
                default_quantity = ?,
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        data.description || null,
        data.default_price_rate || 0,
        data.default_quantity || 1,
        existingId,
      ],
    });

    const refreshed = await turso.execute({
      sql: `SELECT ece.*, u.first_name || ' ' || u.last_name as created_by_name
            FROM estimate_custom_entries ece
            LEFT JOIN users u ON ece.created_by = u.id
            WHERE ece.id = ?`,
      args: [existingId],
    });
    return mapRowToEstimateCustomEntry(refreshed.rows[0]);
  }

  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO estimate_custom_entries
          (id, name, description, default_price_rate, default_quantity, created_by)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      normalizedName,
      data.description || null,
      data.default_price_rate || 0,
      data.default_quantity || 1,
      data.created_by || null,
    ],
  });

  const result = await turso.execute({
    sql: `SELECT ece.*, u.first_name || ' ' || u.last_name as created_by_name
          FROM estimate_custom_entries ece
          LEFT JOIN users u ON ece.created_by = u.id
          WHERE ece.id = ?`,
    args: [id],
  });
  return mapRowToEstimateCustomEntry(result.rows[0]);
}

export interface EstimateLineItem {
  id: string;
  project_id: string;
  category: string;
  custom_category_name: string | null;
  description: string | null;
  price_rate: number;
  quantity: number;
  total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapRowToEstimateLineItem(row: Record<string, unknown>): EstimateLineItem {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    category: row.category as string,
    custom_category_name: row.custom_category_name as string | null,
    description: row.description as string | null,
    price_rate: (row.price_rate as number) || 0,
    quantity: (row.quantity as number) || 1,
    total: (row.total as number) || 0,
    sort_order: (row.sort_order as number) || 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getEstimateLineItems(projectId: string): Promise<EstimateLineItem[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM estimate_line_items WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC`,
    args: [projectId],
  });
  return result.rows.map(mapRowToEstimateLineItem);
}

export async function createEstimateLineItem(data: {
  project_id: string;
  category: string;
  custom_category_name?: string;
  description?: string;
  price_rate: number;
  quantity: number;
}): Promise<EstimateLineItem> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const total = data.price_rate * data.quantity;

  const maxResult = await turso.execute({
    sql: `SELECT MAX(sort_order) as max_order FROM estimate_line_items WHERE project_id = ?`,
    args: [data.project_id],
  });
  const maxOrder = (maxResult.rows[0]?.max_order as number) || 0;

  await turso.execute({
    sql: `INSERT INTO estimate_line_items (id, project_id, category, custom_category_name, description, price_rate, quantity, total, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.project_id,
      data.category,
      data.custom_category_name || null,
      data.description || null,
      data.price_rate,
      data.quantity,
      total,
      maxOrder + 1,
    ],
  });

  const result = await turso.execute({
    sql: `SELECT * FROM estimate_line_items WHERE id = ?`,
    args: [id],
  });
  return mapRowToEstimateLineItem(result.rows[0]);
}

export async function updateEstimateLineItem(
  itemId: string,
  data: Partial<Pick<EstimateLineItem, "category" | "custom_category_name" | "description" | "price_rate" | "quantity">>
): Promise<EstimateLineItem | null> {
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.category !== undefined) {
    updates.push("category = ?");
    args.push(data.category);
  }
  if (data.custom_category_name !== undefined) {
    updates.push("custom_category_name = ?");
    args.push(data.custom_category_name);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    args.push(data.description);
  }
  if (data.price_rate !== undefined) {
    updates.push("price_rate = ?");
    args.push(data.price_rate);
  }
  if (data.quantity !== undefined) {
    updates.push("quantity = ?");
    args.push(data.quantity);
  }

  // Recalculate total if price_rate or quantity changed
  if (data.price_rate !== undefined || data.quantity !== undefined) {
    // Fetch current values to compute new total
    const current = await turso.execute({
      sql: `SELECT price_rate, quantity FROM estimate_line_items WHERE id = ?`,
      args: [itemId],
    });
    if (current.rows.length === 0) return null;

    const rate = data.price_rate !== undefined ? data.price_rate : (current.rows[0].price_rate as number);
    const qty = data.quantity !== undefined ? data.quantity : (current.rows[0].quantity as number);
    updates.push("total = ?");
    args.push(rate * qty);
  }

  if (updates.length === 0) {
    const result = await turso.execute({
      sql: `SELECT * FROM estimate_line_items WHERE id = ?`,
      args: [itemId],
    });
    return result.rows.length > 0 ? mapRowToEstimateLineItem(result.rows[0]) : null;
  }

  updates.push("updated_at = datetime('now')");
  args.push(itemId);

  await turso.execute({
    sql: `UPDATE estimate_line_items SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  const result = await turso.execute({
    sql: `SELECT * FROM estimate_line_items WHERE id = ?`,
    args: [itemId],
  });
  return result.rows.length > 0 ? mapRowToEstimateLineItem(result.rows[0]) : null;
}

export async function deleteEstimateLineItem(itemId: string): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM estimate_line_items WHERE id = ?`,
    args: [itemId],
  });
}

export async function getEstimateTotal(projectId: string): Promise<number> {
  const result = await turso.execute({
    sql: `SELECT COALESCE(SUM(total), 0) as estimate_total FROM estimate_line_items WHERE project_id = ?`,
    args: [projectId],
  });
  return (result.rows[0].estimate_total as number) || 0;
}

// ============ ESTIMATE SETTINGS & DELIVERY ============

export interface ProjectEstimateSettings extends EstimateSettingsInput {
  project_id: string;
  updated_at: string;
}

export interface ProjectEstimateDelivery {
  id: string;
  project_id: string;
  sent_by: string | null;
  sent_to_email: string;
  recipient_user_id: string | null;
  snapshot_line_items: EstimateLineItem[];
  snapshot_settings: EstimateSettingsInput;
  snapshot_total: number;
  tracking_token: string;
  sent_at: string;
  email_opened_at: string | null;
  first_viewed_at: string | null;
  status: "sent" | "revoked";
  sent_by_name?: string;
  recipient_name?: string;
}

export interface ProjectEstimateEvent {
  id: string;
  delivery_id: string;
  event_type: "sent" | "email_opened" | "viewed_in_app";
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_name?: string;
}

let estimateDeliveryTablesReady = false;
let estimateDeliveryTablesReadyPromise: Promise<void> | null = null;

async function ensureEstimateDeliveryTables(): Promise<void> {
  if (estimateDeliveryTablesReady) return;
  if (estimateDeliveryTablesReadyPromise) {
    await estimateDeliveryTablesReadyPromise;
    return;
  }

  estimateDeliveryTablesReadyPromise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS project_estimate_settings (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        markup_type TEXT NOT NULL DEFAULT 'percentage' CHECK (markup_type IN ('percentage', 'fixed')),
        markup_value REAL NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        servicing_fee INTEGER NOT NULL DEFAULT 1,
        installment_schedule TEXT NOT NULL DEFAULT '[]',
        custom_terms TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS project_estimate_deliveries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        sent_to_email TEXT NOT NULL,
        recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        snapshot_line_items TEXT NOT NULL,
        snapshot_settings TEXT NOT NULL,
        snapshot_total REAL NOT NULL DEFAULT 0,
        tracking_token TEXT NOT NULL UNIQUE,
        sent_at TEXT NOT NULL DEFAULT (datetime('now')),
        email_opened_at TEXT,
        first_viewed_at TEXT,
        status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'revoked'))
      )
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS project_estimate_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        delivery_id TEXT NOT NULL REFERENCES project_estimate_deliveries(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'email_opened', 'viewed_in_app')),
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        user_email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_estimate_deliveries_project ON project_estimate_deliveries(project_id)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_estimate_deliveries_token ON project_estimate_deliveries(tracking_token)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_estimate_deliveries_status ON project_estimate_deliveries(project_id, status)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_estimate_events_delivery ON project_estimate_events(delivery_id)"
    );

    estimateDeliveryTablesReady = true;
  })();

  try {
    await estimateDeliveryTablesReadyPromise;
  } finally {
    estimateDeliveryTablesReadyPromise = null;
  }
}

function mapRowToEstimateSettings(row: Record<string, unknown>): ProjectEstimateSettings {
  const schedule = parseInstallmentSchedule(row.installment_schedule);
  return {
    project_id: row.project_id as string,
    markup_type: (row.markup_type as ProjectEstimateSettings["markup_type"]) || "percentage",
    markup_value: (row.markup_value as number) || 0,
    tax_rate: (row.tax_rate as number) || 0,
    servicing_fee: Boolean(row.servicing_fee),
    installment_schedule: schedule.length > 0 ? schedule : DEFAULT_INSTALLMENT_SCHEDULE,
    custom_terms: (row.custom_terms as string | null) || null,
    updated_at: row.updated_at as string,
  };
}

function mapRowToEstimateDelivery(row: Record<string, unknown>): ProjectEstimateDelivery {
  let snapshotLineItems: EstimateLineItem[] = [];
  let snapshotSettings: EstimateSettingsInput = { ...DEFAULT_ESTIMATE_SETTINGS };

  try {
    snapshotLineItems = JSON.parse(row.snapshot_line_items as string) as EstimateLineItem[];
  } catch {
    snapshotLineItems = [];
  }

  try {
    const parsed = JSON.parse(row.snapshot_settings as string) as EstimateSettingsInput;
    snapshotSettings = {
      ...DEFAULT_ESTIMATE_SETTINGS,
      ...parsed,
      installment_schedule: parseInstallmentSchedule(parsed.installment_schedule),
    };
  } catch {
    snapshotSettings = { ...DEFAULT_ESTIMATE_SETTINGS };
  }

  return {
    id: row.id as string,
    project_id: row.project_id as string,
    sent_by: row.sent_by as string | null,
    sent_to_email: row.sent_to_email as string,
    recipient_user_id: row.recipient_user_id as string | null,
    snapshot_line_items: snapshotLineItems,
    snapshot_settings: snapshotSettings,
    snapshot_total: (row.snapshot_total as number) || 0,
    tracking_token: row.tracking_token as string,
    sent_at: row.sent_at as string,
    email_opened_at: (row.email_opened_at as string | null) || null,
    first_viewed_at: (row.first_viewed_at as string | null) || null,
    status: (row.status as ProjectEstimateDelivery["status"]) || "sent",
    sent_by_name: row.sent_by_name as string | undefined,
    recipient_name: row.recipient_name as string | undefined,
  };
}

function mapRowToEstimateEvent(row: Record<string, unknown>): ProjectEstimateEvent {
  return {
    id: row.id as string,
    delivery_id: row.delivery_id as string,
    event_type: row.event_type as ProjectEstimateEvent["event_type"],
    user_id: row.user_id as string | null,
    user_email: row.user_email as string | null,
    ip_address: row.ip_address as string | null,
    user_agent: row.user_agent as string | null,
    created_at: row.created_at as string,
    user_name: row.user_name as string | undefined,
  };
}

export async function getProjectEstimateSettings(
  projectId: string
): Promise<ProjectEstimateSettings> {
  await ensureEstimateDeliveryTables();

  const result = await turso.execute({
    sql: `SELECT * FROM project_estimate_settings WHERE project_id = ?`,
    args: [projectId],
  });

  if (result.rows.length === 0) {
    return {
      project_id: projectId,
      ...DEFAULT_ESTIMATE_SETTINGS,
      installment_schedule: DEFAULT_INSTALLMENT_SCHEDULE,
      updated_at: new Date().toISOString(),
    };
  }

  return mapRowToEstimateSettings(result.rows[0]);
}

export async function upsertProjectEstimateSettings(
  projectId: string,
  data: Partial<EstimateSettingsInput>
): Promise<ProjectEstimateSettings> {
  await ensureEstimateDeliveryTables();

  const existing = await getProjectEstimateSettings(projectId);
  const merged: EstimateSettingsInput = {
    markup_type: data.markup_type ?? existing.markup_type,
    markup_value: data.markup_value ?? existing.markup_value,
    tax_rate: data.tax_rate ?? existing.tax_rate,
    servicing_fee: data.servicing_fee ?? existing.servicing_fee,
    installment_schedule: data.installment_schedule ?? existing.installment_schedule,
    custom_terms: data.custom_terms !== undefined ? data.custom_terms : existing.custom_terms,
  };

  await turso.execute({
    sql: `INSERT INTO project_estimate_settings
          (project_id, markup_type, markup_value, tax_rate, servicing_fee, installment_schedule, custom_terms, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(project_id) DO UPDATE SET
            markup_type = excluded.markup_type,
            markup_value = excluded.markup_value,
            tax_rate = excluded.tax_rate,
            servicing_fee = excluded.servicing_fee,
            installment_schedule = excluded.installment_schedule,
            custom_terms = excluded.custom_terms,
            updated_at = datetime('now')`,
    args: [
      projectId,
      merged.markup_type,
      merged.markup_value,
      merged.tax_rate,
      merged.servicing_fee ? 1 : 0,
      JSON.stringify(merged.installment_schedule),
      merged.custom_terms,
    ],
  });

  return getProjectEstimateSettings(projectId);
}

export async function revokeActiveEstimateDeliveries(projectId: string): Promise<void> {
  await ensureEstimateDeliveryTables();
  await turso.execute({
    sql: `UPDATE project_estimate_deliveries SET status = 'revoked' WHERE project_id = ? AND status = 'sent'`,
    args: [projectId],
  });
}

export async function createEstimateDelivery(data: {
  project_id: string;
  sent_by: string;
  sent_to_email: string;
  recipient_user_id?: string | null;
  snapshot_line_items: EstimateLineItem[];
  snapshot_settings: EstimateSettingsInput;
  snapshot_total: number;
}): Promise<ProjectEstimateDelivery> {
  await ensureEstimateDeliveryTables();

  await revokeActiveEstimateDeliveries(data.project_id);

  const id = crypto.randomUUID().replace(/-/g, "");
  const trackingToken = crypto.randomUUID().replace(/-/g, "");

  await turso.execute({
    sql: `INSERT INTO project_estimate_deliveries
          (id, project_id, sent_by, sent_to_email, recipient_user_id, snapshot_line_items, snapshot_settings, snapshot_total, tracking_token)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.project_id,
      data.sent_by,
      data.sent_to_email.toLowerCase(),
      data.recipient_user_id || null,
      JSON.stringify(data.snapshot_line_items),
      JSON.stringify(data.snapshot_settings),
      data.snapshot_total,
      trackingToken,
    ],
  });

  await createEstimateEvent({
    delivery_id: id,
    event_type: "sent",
    user_id: data.sent_by,
    user_email: data.sent_to_email,
  });

  const delivery = await getEstimateDeliveryById(id);
  if (!delivery) throw new Error("Failed to create estimate delivery");
  return delivery;
}

export async function getEstimateDeliveryById(id: string): Promise<ProjectEstimateDelivery | null> {
  await ensureEstimateDeliveryTables();
  const result = await turso.execute({
    sql: `SELECT d.*,
                 sender.first_name || ' ' || sender.last_name as sent_by_name,
                 recipient.first_name || ' ' || recipient.last_name as recipient_name
          FROM project_estimate_deliveries d
          LEFT JOIN users sender ON d.sent_by = sender.id
          LEFT JOIN users recipient ON d.recipient_user_id = recipient.id
          WHERE d.id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return mapRowToEstimateDelivery(result.rows[0]);
}

export async function getEstimateDeliveryByToken(
  token: string
): Promise<ProjectEstimateDelivery | null> {
  await ensureEstimateDeliveryTables();
  const result = await turso.execute({
    sql: `SELECT d.*,
                 sender.first_name || ' ' || sender.last_name as sent_by_name,
                 recipient.first_name || ' ' || recipient.last_name as recipient_name
          FROM project_estimate_deliveries d
          LEFT JOIN users sender ON d.sent_by = sender.id
          LEFT JOIN users recipient ON d.recipient_user_id = recipient.id
          WHERE d.tracking_token = ?`,
    args: [token],
  });
  if (result.rows.length === 0) return null;
  return mapRowToEstimateDelivery(result.rows[0]);
}

export async function getActiveEstimateDelivery(
  projectId: string
): Promise<ProjectEstimateDelivery | null> {
  await ensureEstimateDeliveryTables();
  const result = await turso.execute({
    sql: `SELECT d.*,
                 sender.first_name || ' ' || sender.last_name as sent_by_name,
                 recipient.first_name || ' ' || recipient.last_name as recipient_name
          FROM project_estimate_deliveries d
          LEFT JOIN users sender ON d.sent_by = sender.id
          LEFT JOIN users recipient ON d.recipient_user_id = recipient.id
          WHERE d.project_id = ? AND d.status = 'sent'
          ORDER BY d.sent_at DESC
          LIMIT 1`,
    args: [projectId],
  });
  if (result.rows.length === 0) return null;
  return mapRowToEstimateDelivery(result.rows[0]);
}

export async function getEstimateDeliveries(
  projectId: string
): Promise<ProjectEstimateDelivery[]> {
  await ensureEstimateDeliveryTables();
  const result = await turso.execute({
    sql: `SELECT d.*,
                 sender.first_name || ' ' || sender.last_name as sent_by_name,
                 recipient.first_name || ' ' || recipient.last_name as recipient_name
          FROM project_estimate_deliveries d
          LEFT JOIN users sender ON d.sent_by = sender.id
          LEFT JOIN users recipient ON d.recipient_user_id = recipient.id
          WHERE d.project_id = ?
          ORDER BY d.sent_at DESC`,
    args: [projectId],
  });
  return result.rows.map(mapRowToEstimateDelivery);
}

export async function createEstimateEvent(data: {
  delivery_id: string;
  event_type: ProjectEstimateEvent["event_type"];
  user_id?: string | null;
  user_email?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}): Promise<ProjectEstimateEvent> {
  await ensureEstimateDeliveryTables();
  const id = crypto.randomUUID().replace(/-/g, "");

  await turso.execute({
    sql: `INSERT INTO project_estimate_events
          (id, delivery_id, event_type, user_id, user_email, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.delivery_id,
      data.event_type,
      data.user_id || null,
      data.user_email || null,
      data.ip_address || null,
      data.user_agent || null,
    ],
  });

  const result = await turso.execute({
    sql: `SELECT e.*, u.first_name || ' ' || u.last_name as user_name
          FROM project_estimate_events e
          LEFT JOIN users u ON e.user_id = u.id
          WHERE e.id = ?`,
    args: [id],
  });

  return mapRowToEstimateEvent(result.rows[0]);
}

export async function getEstimateEvents(deliveryId: string): Promise<ProjectEstimateEvent[]> {
  await ensureEstimateDeliveryTables();
  const result = await turso.execute({
    sql: `SELECT e.*, u.first_name || ' ' || u.last_name as user_name
          FROM project_estimate_events e
          LEFT JOIN users u ON e.user_id = u.id
          WHERE e.delivery_id = ?
          ORDER BY e.created_at ASC`,
    args: [deliveryId],
  });
  return result.rows.map(mapRowToEstimateEvent);
}

export async function markEstimateEmailOpened(
  deliveryId: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<boolean> {
  await ensureEstimateDeliveryTables();

  const delivery = await getEstimateDeliveryById(deliveryId);
  if (!delivery || delivery.email_opened_at) return false;

  await turso.execute({
    sql: `UPDATE project_estimate_deliveries SET email_opened_at = datetime('now') WHERE id = ?`,
    args: [deliveryId],
  });

  await createEstimateEvent({
    delivery_id: deliveryId,
    event_type: "email_opened",
    user_email: delivery.sent_to_email,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  return true;
}

export async function markEstimateViewedInApp(data: {
  deliveryId: string;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ isFirstView: boolean; event: ProjectEstimateEvent }> {
  await ensureEstimateDeliveryTables();

  const delivery = await getEstimateDeliveryById(data.deliveryId);
  if (!delivery) throw new Error("Delivery not found");

  const isFirstView = !delivery.first_viewed_at;

  if (isFirstView) {
    await turso.execute({
      sql: `UPDATE project_estimate_deliveries SET first_viewed_at = datetime('now') WHERE id = ?`,
      args: [data.deliveryId],
    });
  }

  const event = await createEstimateEvent({
    delivery_id: data.deliveryId,
    event_type: "viewed_in_app",
    user_id: data.userId,
    user_email: data.userEmail,
    ip_address: data.ipAddress,
    user_agent: data.userAgent,
  });

  return { isFirstView, event };
}

export async function getProjectClientUsers(
  projectId: string
): Promise<Array<{ id: string; email: string; first_name: string; last_name: string }>> {
  const result = await turso.execute({
    sql: `SELECT u.id, u.email, u.first_name, u.last_name
          FROM users u
          INNER JOIN project_assignments pa ON pa.user_id = u.id
          WHERE pa.project_id = ? AND u.role = 'client'
          ORDER BY u.last_name, u.first_name`,
    args: [projectId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
  }));
}

export interface ProjectEstimateRecipient {
  id: string | null;
  email: string;
  name: string;
  status: "registered" | "invited";
  invitation_token?: string;
}

export async function getProjectEstimateRecipients(
  projectId: string
): Promise<ProjectEstimateRecipient[]> {
  const [clients, invitations] = await Promise.all([
    getProjectClientUsers(projectId),
    getProjectInvitations(projectId),
  ]);

  const recipients: ProjectEstimateRecipient[] = [];
  const seenEmails = new Set<string>();

  for (const client of clients) {
    const email = client.email.toLowerCase();
    seenEmails.add(email);
    recipients.push({
      id: client.id,
      email: client.email,
      name: `${client.first_name} ${client.last_name}`.trim() || client.email,
      status: "registered",
    });
  }

  for (const invitation of invitations) {
    if (invitation.status !== "pending") continue;
    const email = invitation.email.toLowerCase();
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    recipients.push({
      id: null,
      email: invitation.email,
      name: invitation.email,
      status: "invited",
      invitation_token: invitation.token,
    });
  }

  return recipients;
}

export async function getPendingInvitationForEmail(
  projectId: string,
  email: string
): Promise<ProjectInvitation | null> {
  const invitations = await getProjectInvitations(projectId);
  return (
    invitations.find(
      (inv) => inv.status === "pending" && inv.email.toLowerCase() === email.toLowerCase()
    ) || null
  );
}

export function stripProjectPricingForEmployee<T extends Project>(project: T): Omit<T, "budget_amount" | "funding_notes" | "hide_line_item_prices_for_client" | "hide_markup_for_client"> & {
  budget_amount: null;
  funding_notes: null;
  hide_line_item_prices_for_client: undefined;
  hide_markup_for_client: undefined;
} {
  const { budget_amount, funding_notes, hide_line_item_prices_for_client, hide_markup_for_client, ...rest } = project;
  return {
    ...rest,
    budget_amount: null,
    funding_notes: null,
    hide_line_item_prices_for_client: undefined,
    hide_markup_for_client: undefined,
  };
}

// ============ IMAGE FUNCTIONS ============

function mapRowToImage(row: Record<string, unknown>): ProjectImage {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    filename: row.filename as string,
    s3_key: row.s3_key as string | null,
    s3_url: row.s3_url as string | null,
    caption: row.caption as string | null,
    uploaded_by: row.uploaded_by as string | null,
    uploader_name: row.uploader_name as string | undefined,
    created_at: row.created_at as string,
  };
}

export async function getProjectImages(projectId: string): Promise<ProjectImage[]> {
  const result = await turso.execute({
    sql: `SELECT pi.*, u.first_name || ' ' || u.last_name as uploader_name
          FROM project_images pi
          LEFT JOIN users u ON pi.uploaded_by = u.id
          WHERE pi.project_id = ?
          ORDER BY pi.created_at DESC`,
    args: [projectId],
  });
  return result.rows.map(mapRowToImage);
}

export async function addProjectImage(data: {
  project_id: string;
  filename: string;
  s3_key?: string;
  s3_url?: string;
  caption?: string;
  uploaded_by?: string;
}): Promise<ProjectImage> {
  const id = crypto.randomUUID().replace(/-/g, "");
  
  await turso.execute({
    sql: `INSERT INTO project_images (id, project_id, filename, s3_key, s3_url, caption, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.project_id,
      data.filename,
      data.s3_key || null,
      data.s3_url || null,
      data.caption || null,
      data.uploaded_by || null,
    ],
  });
  
  const result = await turso.execute({
    sql: `SELECT pi.*, u.first_name || ' ' || u.last_name as uploader_name
          FROM project_images pi
          LEFT JOIN users u ON pi.uploaded_by = u.id
          WHERE pi.id = ?`,
    args: [id],
  });
  return mapRowToImage(result.rows[0]);
}

export async function updateProjectImage(
  imageId: string,
  data: { caption?: string }
): Promise<ProjectImage | null> {
  if (data.caption !== undefined) {
    await turso.execute({
      sql: `UPDATE project_images SET caption = ? WHERE id = ?`,
      args: [data.caption, imageId],
    });
  }
  
  const result = await turso.execute({
    sql: `SELECT pi.*, u.first_name || ' ' || u.last_name as uploader_name
          FROM project_images pi
          LEFT JOIN users u ON pi.uploaded_by = u.id
          WHERE pi.id = ?`,
    args: [imageId],
  });
  return result.rows.length > 0 ? mapRowToImage(result.rows[0]) : null;
}

export async function deleteProjectImage(imageId: string): Promise<ProjectImage | null> {
  // Get the image first so we can return it (for S3 cleanup)
  const result = await turso.execute({
    sql: `SELECT * FROM project_images WHERE id = ?`,
    args: [imageId],
  });
  
  if (result.rows.length === 0) return null;
  
  const image = mapRowToImage(result.rows[0]);
  
  await turso.execute({
    sql: `DELETE FROM project_images WHERE id = ?`,
    args: [imageId],
  });
  
  return image;
}

export async function getProjectImageCount(projectId: string): Promise<number> {
  const result = await turso.execute({
    sql: `SELECT COUNT(*) as count FROM project_images WHERE project_id = ?`,
    args: [projectId],
  });
  return (result.rows[0].count as number) || 0;
}

// ============ INVITATION FUNCTIONS ============

function mapRowToInvitation(row: Record<string, unknown>): ProjectInvitation {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    email: row.email as string,
    token: row.token as string,
    invited_by: row.invited_by as string | null,
    inviter_name: row.inviter_name as string | undefined,
    status: row.status as ProjectInvitation["status"],
    expires_at: row.expires_at as string,
    created_at: row.created_at as string,
    accepted_at: row.accepted_at as string | null,
  };
}

export async function createProjectInvitation(data: {
  project_id: string;
  email: string;
  invited_by: string;
}): Promise<ProjectInvitation> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const token = crypto.randomUUID().replace(/-/g, "");

  // Expire in 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await turso.execute({
    sql: `INSERT INTO project_invitations (id, project_id, email, token, invited_by, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.project_id,
      data.email.toLowerCase(),
      token,
      data.invited_by,
      expiresAt.toISOString(),
    ],
  });

  const result = await turso.execute({
    sql: `SELECT pi.*, u.first_name || ' ' || u.last_name as inviter_name
          FROM project_invitations pi
          LEFT JOIN users u ON pi.invited_by = u.id
          WHERE pi.id = ?`,
    args: [id],
  });

  return mapRowToInvitation(result.rows[0]);
}

export async function getProjectInvitations(projectId: string): Promise<ProjectInvitation[]> {
  const result = await turso.execute({
    sql: `SELECT pi.*, u.first_name || ' ' || u.last_name as inviter_name
          FROM project_invitations pi
          LEFT JOIN users u ON pi.invited_by = u.id
          WHERE pi.project_id = ?
          ORDER BY pi.created_at DESC`,
    args: [projectId],
  });
  return result.rows.map(mapRowToInvitation);
}

export async function getInvitationByToken(token: string): Promise<ProjectInvitation | null> {
  const result = await turso.execute({
    sql: `SELECT pi.*, u.first_name || ' ' || u.last_name as inviter_name
          FROM project_invitations pi
          LEFT JOIN users u ON pi.invited_by = u.id
          WHERE pi.token = ?`,
    args: [token],
  });
  if (result.rows.length === 0) return null;
  return mapRowToInvitation(result.rows[0]);
}

export async function getInvitationsByEmail(email: string): Promise<ProjectInvitation[]> {
  const result = await turso.execute({
    sql: `SELECT pi.*, u.first_name || ' ' || u.last_name as inviter_name
          FROM project_invitations pi
          LEFT JOIN users u ON pi.invited_by = u.id
          WHERE pi.email = ? AND pi.status = 'pending'`,
    args: [email.toLowerCase()],
  });
  return result.rows.map(mapRowToInvitation);
}

export async function acceptInvitation(token: string, userId: string): Promise<boolean> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) return false;
  if (invitation.status !== "pending") return false;

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    await turso.execute({
      sql: `UPDATE project_invitations SET status = 'expired' WHERE id = ?`,
      args: [invitation.id],
    });
    return false;
  }

  // Mark as accepted
  await turso.execute({
    sql: `UPDATE project_invitations SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?`,
    args: [invitation.id],
  });

  // Assign user to project
  await assignUserToProject(invitation.project_id, userId);

  return true;
}

export async function processPendingInvitationsForUser(email: string, userId: string): Promise<number> {
  const invitations = await getInvitationsByEmail(email);
  let processed = 0;

  for (const invitation of invitations) {
    // Check if not expired
    if (new Date(invitation.expires_at) >= new Date()) {
      await turso.execute({
        sql: `UPDATE project_invitations SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?`,
        args: [invitation.id],
      });
      await assignUserToProject(invitation.project_id, userId);
      processed++;
    } else {
      await turso.execute({
        sql: `UPDATE project_invitations SET status = 'expired' WHERE id = ?`,
        args: [invitation.id],
      });
    }
  }

  return processed;
}

