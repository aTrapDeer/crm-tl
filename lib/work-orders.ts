import { turso } from "./turso";

export interface WorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  time_received: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  department: string | null;
  location: string | null;
  unit: string | null;
  area: string | null;
  access_needed: string | null;
  preferred_entry_time: string | null;
  priority: "emergency" | "high" | "normal" | "low";
  service_type: "maintenance" | "repair" | "replace" | "inspection" | "preventive" | "cleaning" | "other";
  description: string;
  assigned_to: string | null;
  assigned_user_name?: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  time_in: string | null;
  time_out: string | null;
  total_labor_hours: number | null;
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  completed_date: string | null;
  completed_time: string | null;
  work_summary: string | null;
  project_id: string | null;
  project_name?: string;
  created_by: string | null;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderMaterial {
  id: string;
  work_order_id: string;
  material_name: string;
  quantity: number;
  unit: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface WorkOrderSignature {
  id: string;
  work_order_id: string;
  signer_type: "tl_corp_rep" | "building_rep";
  signer_name: string;
  signer_title: string | null;
  signature_data: string;
  signed_date: string;
  signed_at: string;
  ip_address: string | null;
  created_at: string;
}

function mapRowToWorkOrder(row: Record<string, unknown>): WorkOrder {
  return {
    id: row.id as string,
    work_order_number: row.work_order_number as string,
    date: row.date as string,
    time_received: row.time_received as string | null,
    phone: row.phone as string | null,
    email: row.email as string | null,
    company: row.company as string | null,
    department: row.department as string | null,
    location: row.location as string | null,
    unit: row.unit as string | null,
    area: row.area as string | null,
    access_needed: row.access_needed as string | null,
    preferred_entry_time: row.preferred_entry_time as string | null,
    priority: row.priority as WorkOrder["priority"],
    service_type: row.service_type as WorkOrder["service_type"],
    description: row.description as string,
    assigned_to: row.assigned_to as string | null,
    assigned_user_name: row.assigned_user_name as string | undefined,
    scheduled_date: row.scheduled_date as string | null,
    scheduled_time: row.scheduled_time as string | null,
    time_in: row.time_in as string | null,
    time_out: row.time_out as string | null,
    total_labor_hours: row.total_labor_hours as number | null,
    work_completed: row.work_completed as WorkOrder["work_completed"],
    completed_date: row.completed_date as string | null,
    completed_time: row.completed_time as string | null,
    work_summary: row.work_summary as string | null,
    project_id: row.project_id as string | null,
    project_name: row.project_name as string | undefined,
    created_by: row.created_by as string | null,
    creator_name: row.creator_name as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapRowToMaterial(row: Record<string, unknown>): WorkOrderMaterial {
  return {
    id: row.id as string,
    work_order_id: row.work_order_id as string,
    material_name: row.material_name as string,
    quantity: row.quantity as number,
    unit: row.unit as string | null,
    unit_cost: row.unit_cost as number | null,
    total_cost: row.total_cost as number | null,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
  };
}

function mapRowToSignature(row: Record<string, unknown>): WorkOrderSignature {
  return {
    id: row.id as string,
    work_order_id: row.work_order_id as string,
    signer_type: row.signer_type as WorkOrderSignature["signer_type"],
    signer_name: row.signer_name as string,
    signer_title: row.signer_title as string | null,
    signature_data: row.signature_data as string,
    signed_date: row.signed_date as string,
    signed_at: row.signed_at as string,
    ip_address: row.ip_address as string | null,
    created_at: row.created_at as string,
  };
}

// Generate work order number (format: WO-YYYYMMDD-XXX)
export async function generateWorkOrderNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `WO-${today}-`;

  const result = await turso.execute({
    sql: `SELECT work_order_number FROM work_orders
          WHERE work_order_number LIKE ?
          ORDER BY work_order_number DESC LIMIT 1`,
    args: [`${prefix}%`],
  });

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].work_order_number as string;
    const lastSequence = parseInt(lastNumber.split("-").pop() || "0", 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(3, "0")}`;
}

// ============ WORK ORDER CRUD ============

export async function getAllWorkOrders(): Promise<WorkOrder[]> {
  const result = await turso.execute(`
    SELECT wo.*,
           u.first_name || ' ' || u.last_name as assigned_user_name,
           p.name as project_name,
           c.first_name || ' ' || c.last_name as creator_name
    FROM work_orders wo
    LEFT JOIN users u ON wo.assigned_to = u.id
    LEFT JOIN projects p ON wo.project_id = p.id
    LEFT JOIN users c ON wo.created_by = c.id
    ORDER BY wo.created_at DESC
  `);
  return result.rows.map(mapRowToWorkOrder);
}

export async function getWorkOrdersByAssignee(userId: string): Promise<WorkOrder[]> {
  const result = await turso.execute({
    sql: `SELECT wo.*,
                 u.first_name || ' ' || u.last_name as assigned_user_name,
                 p.name as project_name,
                 c.first_name || ' ' || c.last_name as creator_name
          FROM work_orders wo
          LEFT JOIN users u ON wo.assigned_to = u.id
          LEFT JOIN projects p ON wo.project_id = p.id
          LEFT JOIN users c ON wo.created_by = c.id
          WHERE wo.assigned_to = ?
          ORDER BY wo.created_at DESC`,
    args: [userId],
  });
  return result.rows.map(mapRowToWorkOrder);
}

export async function getWorkOrderById(id: string): Promise<WorkOrder | null> {
  const result = await turso.execute({
    sql: `SELECT wo.*,
                 u.first_name || ' ' || u.last_name as assigned_user_name,
                 p.name as project_name,
                 c.first_name || ' ' || c.last_name as creator_name
          FROM work_orders wo
          LEFT JOIN users u ON wo.assigned_to = u.id
          LEFT JOIN projects p ON wo.project_id = p.id
          LEFT JOIN users c ON wo.created_by = c.id
          WHERE wo.id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return mapRowToWorkOrder(result.rows[0]);
}

export async function createWorkOrder(data: {
  work_order_number: string;
  date?: string;
  time_received?: string;
  phone?: string;
  email?: string;
  company?: string;
  department?: string;
  location?: string;
  unit?: string;
  area?: string;
  access_needed?: string;
  preferred_entry_time?: string;
  priority?: WorkOrder["priority"];
  service_type?: WorkOrder["service_type"];
  description: string;
  assigned_to?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  project_id?: string;
  created_by?: string;
}): Promise<WorkOrder> {
  const id = crypto.randomUUID().replace(/-/g, "");

  await turso.execute({
    sql: `INSERT INTO work_orders (
            id, work_order_number, date, time_received, phone, email, company, department,
            location, unit, area, access_needed, preferred_entry_time,
            priority, service_type, description, assigned_to, scheduled_date, scheduled_time,
            project_id, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.work_order_number,
      data.date || new Date().toISOString().slice(0, 10),
      data.time_received || null,
      data.phone || null,
      data.email || null,
      data.company || null,
      data.department || null,
      data.location || null,
      data.unit || null,
      data.area || null,
      data.access_needed || null,
      data.preferred_entry_time || null,
      data.priority || "normal",
      data.service_type || "maintenance",
      data.description,
      data.assigned_to || null,
      data.scheduled_date || null,
      data.scheduled_time || null,
      data.project_id || null,
      data.created_by || null,
    ],
  });

  return (await getWorkOrderById(id))!;
}

export async function updateWorkOrder(
  id: string,
  data: Partial<Omit<WorkOrder, "id" | "work_order_number" | "created_at" | "created_by">>
): Promise<WorkOrder | null> {
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  const fields: { key: keyof typeof data; column: string }[] = [
    { key: "date", column: "date" },
    { key: "time_received", column: "time_received" },
    { key: "phone", column: "phone" },
    { key: "email", column: "email" },
    { key: "company", column: "company" },
    { key: "department", column: "department" },
    { key: "location", column: "location" },
    { key: "unit", column: "unit" },
    { key: "area", column: "area" },
    { key: "access_needed", column: "access_needed" },
    { key: "preferred_entry_time", column: "preferred_entry_time" },
    { key: "priority", column: "priority" },
    { key: "service_type", column: "service_type" },
    { key: "description", column: "description" },
    { key: "assigned_to", column: "assigned_to" },
    { key: "scheduled_date", column: "scheduled_date" },
    { key: "scheduled_time", column: "scheduled_time" },
    { key: "time_in", column: "time_in" },
    { key: "time_out", column: "time_out" },
    { key: "total_labor_hours", column: "total_labor_hours" },
    { key: "work_completed", column: "work_completed" },
    { key: "completed_date", column: "completed_date" },
    { key: "completed_time", column: "completed_time" },
    { key: "work_summary", column: "work_summary" },
    { key: "project_id", column: "project_id" },
  ];

  for (const { key, column } of fields) {
    if (data[key] !== undefined) {
      updates.push(`${column} = ?`);
      args.push(data[key] as string | number | null);
    }
  }

  if (updates.length === 0) return getWorkOrderById(id);

  updates.push("updated_at = datetime('now')");
  args.push(id);

  await turso.execute({
    sql: `UPDATE work_orders SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  return getWorkOrderById(id);
}

export async function deleteWorkOrder(id: string): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM work_orders WHERE id = ?`,
    args: [id],
  });
}

// ============ WORK ORDER STATS ============

export async function getWorkOrderStats(): Promise<{
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  emergency: number;
}> {
  const result = await turso.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN work_completed = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN work_completed = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN work_completed = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN work_completed = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN priority = 'emergency' AND work_completed NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as emergency
    FROM work_orders
  `);

  const row = result.rows[0];
  return {
    total: (row.total as number) || 0,
    pending: (row.pending as number) || 0,
    in_progress: (row.in_progress as number) || 0,
    completed: (row.completed as number) || 0,
    cancelled: (row.cancelled as number) || 0,
    emergency: (row.emergency as number) || 0,
  };
}

// ============ MATERIALS CRUD ============

export async function getWorkOrderMaterials(workOrderId: string): Promise<WorkOrderMaterial[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM work_order_materials WHERE work_order_id = ? ORDER BY created_at ASC`,
    args: [workOrderId],
  });
  return result.rows.map(mapRowToMaterial);
}

export async function addWorkOrderMaterial(data: {
  work_order_id: string;
  material_name: string;
  quantity?: number;
  unit?: string;
  unit_cost?: number;
  notes?: string;
}): Promise<WorkOrderMaterial> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const quantity = data.quantity || 1;
  const unitCost = data.unit_cost || null;
  const totalCost = unitCost !== null ? quantity * unitCost : null;

  await turso.execute({
    sql: `INSERT INTO work_order_materials (id, work_order_id, material_name, quantity, unit, unit_cost, total_cost, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.work_order_id,
      data.material_name,
      quantity,
      data.unit || null,
      unitCost,
      totalCost,
      data.notes || null,
    ],
  });

  const result = await turso.execute({
    sql: `SELECT * FROM work_order_materials WHERE id = ?`,
    args: [id],
  });
  return mapRowToMaterial(result.rows[0]);
}

export async function updateWorkOrderMaterial(
  materialId: string,
  data: Partial<Pick<WorkOrderMaterial, "material_name" | "quantity" | "unit" | "unit_cost" | "notes">>
): Promise<WorkOrderMaterial | null> {
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.material_name !== undefined) {
    updates.push("material_name = ?");
    args.push(data.material_name);
  }
  if (data.quantity !== undefined) {
    updates.push("quantity = ?");
    args.push(data.quantity);
  }
  if (data.unit !== undefined) {
    updates.push("unit = ?");
    args.push(data.unit);
  }
  if (data.unit_cost !== undefined) {
    updates.push("unit_cost = ?");
    args.push(data.unit_cost);
  }
  if (data.notes !== undefined) {
    updates.push("notes = ?");
    args.push(data.notes);
  }

  // Recalculate total_cost if quantity or unit_cost changed
  if (data.quantity !== undefined || data.unit_cost !== undefined) {
    const current = await turso.execute({
      sql: `SELECT quantity, unit_cost FROM work_order_materials WHERE id = ?`,
      args: [materialId],
    });
    if (current.rows.length > 0) {
      const qty = data.quantity ?? (current.rows[0].quantity as number);
      const cost = data.unit_cost ?? (current.rows[0].unit_cost as number | null);
      const totalCost = cost !== null ? qty * cost : null;
      updates.push("total_cost = ?");
      args.push(totalCost);
    }
  }

  if (updates.length === 0) {
    const result = await turso.execute({
      sql: `SELECT * FROM work_order_materials WHERE id = ?`,
      args: [materialId],
    });
    return result.rows.length > 0 ? mapRowToMaterial(result.rows[0]) : null;
  }

  args.push(materialId);

  await turso.execute({
    sql: `UPDATE work_order_materials SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  const result = await turso.execute({
    sql: `SELECT * FROM work_order_materials WHERE id = ?`,
    args: [materialId],
  });
  return result.rows.length > 0 ? mapRowToMaterial(result.rows[0]) : null;
}

export async function deleteWorkOrderMaterial(materialId: string): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM work_order_materials WHERE id = ?`,
    args: [materialId],
  });
}

export async function getMaterialsTotalCost(workOrderId: string): Promise<number> {
  const result = await turso.execute({
    sql: `SELECT SUM(total_cost) as total FROM work_order_materials WHERE work_order_id = ?`,
    args: [workOrderId],
  });
  return (result.rows[0].total as number) || 0;
}

// ============ SIGNATURES CRUD ============

export async function getWorkOrderSignatures(workOrderId: string): Promise<WorkOrderSignature[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM work_order_signatures WHERE work_order_id = ? ORDER BY created_at ASC`,
    args: [workOrderId],
  });
  return result.rows.map(mapRowToSignature);
}

export async function addWorkOrderSignature(data: {
  work_order_id: string;
  signer_type: WorkOrderSignature["signer_type"];
  signer_name: string;
  signer_title?: string;
  signature_data: string;
  ip_address?: string;
}): Promise<WorkOrderSignature> {
  const id = crypto.randomUUID().replace(/-/g, "");

  // Delete existing signature of same type (only one per type allowed)
  await turso.execute({
    sql: `DELETE FROM work_order_signatures WHERE work_order_id = ? AND signer_type = ?`,
    args: [data.work_order_id, data.signer_type],
  });

  await turso.execute({
    sql: `INSERT INTO work_order_signatures (id, work_order_id, signer_type, signer_name, signer_title, signature_data, ip_address)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.work_order_id,
      data.signer_type,
      data.signer_name,
      data.signer_title || null,
      data.signature_data,
      data.ip_address || null,
    ],
  });

  const result = await turso.execute({
    sql: `SELECT * FROM work_order_signatures WHERE id = ?`,
    args: [id],
  });
  return mapRowToSignature(result.rows[0]);
}

export async function deleteWorkOrderSignature(signatureId: string): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM work_order_signatures WHERE id = ?`,
    args: [signatureId],
  });
}

// ============ SEARCH AND FILTER ============

export interface WorkOrderFilters {
  status?: WorkOrder["work_completed"];
  priority?: WorkOrder["priority"];
  service_type?: WorkOrder["service_type"];
  assigned_to?: string;
  project_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export async function searchWorkOrders(filters: WorkOrderFilters): Promise<WorkOrder[]> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (filters.status) {
    conditions.push("wo.work_completed = ?");
    args.push(filters.status);
  }
  if (filters.priority) {
    conditions.push("wo.priority = ?");
    args.push(filters.priority);
  }
  if (filters.service_type) {
    conditions.push("wo.service_type = ?");
    args.push(filters.service_type);
  }
  if (filters.assigned_to) {
    conditions.push("wo.assigned_to = ?");
    args.push(filters.assigned_to);
  }
  if (filters.project_id) {
    conditions.push("wo.project_id = ?");
    args.push(filters.project_id);
  }
  if (filters.date_from) {
    conditions.push("wo.date >= ?");
    args.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push("wo.date <= ?");
    args.push(filters.date_to);
  }
  if (filters.search) {
    conditions.push(`(
      wo.work_order_number LIKE ? OR
      wo.company LIKE ? OR
      wo.location LIKE ? OR
      wo.description LIKE ?
    )`);
    const searchTerm = `%${filters.search}%`;
    args.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await turso.execute({
    sql: `SELECT wo.*,
                 u.first_name || ' ' || u.last_name as assigned_user_name,
                 p.name as project_name,
                 c.first_name || ' ' || c.last_name as creator_name
          FROM work_orders wo
          LEFT JOIN users u ON wo.assigned_to = u.id
          LEFT JOIN projects p ON wo.project_id = p.id
          LEFT JOIN users c ON wo.created_by = c.id
          ${whereClause}
          ORDER BY wo.created_at DESC`,
    args,
  });

  return result.rows.map(mapRowToWorkOrder);
}
