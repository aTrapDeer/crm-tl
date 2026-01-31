import { turso } from "./turso";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "planning" | "in_progress" | "on_hold" | "completed";
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
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
    is_funded: Boolean(row.is_funded),
    funding_notes: row.funding_notes as string | null,
    on_hold_reason: row.on_hold_reason as string | null,
    expected_resume_date: row.expected_resume_date as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getAllProjects(): Promise<Project[]> {
  const result = await turso.execute(
    "SELECT * FROM projects ORDER BY created_at DESC"
  );
  return result.rows.map(mapRowToProject);
}

export async function getProjectsByUserId(userId: string): Promise<Project[]> {
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
  const result = await turso.execute({
    sql: "SELECT * FROM projects WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return mapRowToProject(result.rows[0]);
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
  funding_notes?: string;
  on_hold_reason?: string;
  expected_resume_date?: string;
}): Promise<Project> {
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
    role: row.role as string,
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
  return {
    id,
    project_id: projectId,
    user_id: userId,
    title,
    content: content || null,
    created_at: new Date().toISOString(),
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
    role: row.role as string,
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
          WHERE pa.project_id = ? AND u.role != 'admin'`,
    args: [projectId],
  });
  return result.rows.map((row) => ({
    user_id: row.user_id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    role: row.role as string,
  }));
}

// ============ ESTIMATE LINE ITEMS ============

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

