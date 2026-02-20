import { turso } from "./turso";
import {
  createDefaultDailyReportPayload,
  normalizeDailyReportPayload,
  type BonanReportStatus,
  type BonanReportType,
  type BonanSite,
  type DailyReportPayload,
} from "./bonan-types";
import { createWorkOrder, generateWorkOrderNumber } from "./work-orders";
import { getUsCentralDate, getUsCentralTimeHHMM } from "./us-central-time";

export interface BonanReport {
  id: string;
  site: BonanSite;
  report_type: BonanReportType;
  status: BonanReportStatus;
  report_date: string;
  work_order_id: string | null;
  work_order_number?: string;
  created_by: string | null;
  creator_name?: string;
  payload: DailyReportPayload | Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string | null;
  submitted_at: string | null;
}

export interface BonanReportFilters {
  report_type?: BonanReportType;
  status?: BonanReportStatus;
}

export interface BonanAssociatedWorkOrder {
  id: string;
  bonan_report_id: string;
  work_order_id: string;
  work_order_number: string;
  date: string;
  priority: "emergency" | "high" | "normal" | "low";
  service_type: "maintenance" | "repair" | "replace" | "inspection" | "preventive" | "cleaning" | "other";
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  description: string;
  created_at: string;
}

function parsePayload(type: BonanReportType, payloadJson: string | null): DailyReportPayload | Record<string, unknown> {
  if (!payloadJson) {
    return type === "daily" ? createDefaultDailyReportPayload() : {};
  }

  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (type === "daily") {
      return normalizeDailyReportPayload(parsed);
    }
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return type === "daily" ? createDefaultDailyReportPayload() : {};
  }
}

function mapRowToBonanReport(row: Record<string, unknown>): BonanReport {
  const reportType = row.report_type as BonanReportType;

  return {
    id: row.id as string,
    site: row.site as BonanSite,
    report_type: reportType,
    status: row.status as BonanReportStatus,
    report_date: row.report_date as string,
    work_order_id: row.work_order_id as string | null,
    work_order_number: row.work_order_number as string | undefined,
    created_by: row.created_by as string | null,
    creator_name: row.creator_name as string | undefined,
    payload: parsePayload(reportType, row.payload_json as string | null),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    last_autosaved_at: row.last_autosaved_at as string | null,
    submitted_at: row.submitted_at as string | null,
  };
}

function getTodayDate(): string {
  return getUsCentralDate();
}

function getCurrentTime(): string {
  return getUsCentralTimeHHMM();
}

function mapRowToAssociatedWorkOrder(row: Record<string, unknown>): BonanAssociatedWorkOrder {
  return {
    id: row.id as string,
    bonan_report_id: row.bonan_report_id as string,
    work_order_id: row.work_order_id as string,
    work_order_number: row.work_order_number as string,
    date: row.date as string,
    priority: row.priority as BonanAssociatedWorkOrder["priority"],
    service_type: row.service_type as BonanAssociatedWorkOrder["service_type"],
    work_completed: row.work_completed as BonanAssociatedWorkOrder["work_completed"],
    description: row.description as string,
    created_at: row.created_at as string,
  };
}

async function createLinkedWorkOrder(reportType: BonanReportType, createdBy: string): Promise<string> {
  const workOrderNumber = await generateWorkOrderNumber();

  const descriptionByType: Record<BonanReportType, string> = {
    daily: "Bonan Towers Daily Walk-Through",
    weekly: "Bonan Towers Weekly Report",
    monthly: "Bonan Towers Monthly Report",
  };

  const workOrder = await createWorkOrder({
    work_order_number: workOrderNumber,
    date: getTodayDate(),
    time_received: getCurrentTime(),
    company: "Bonan Towers",
    department: "Facilities",
    location: "Bonan Towers",
    priority: "normal",
    service_type: "inspection",
    description: descriptionByType[reportType],
    created_by: createdBy,
  });

  return workOrder.id;
}

export async function getBonanReports(filters: BonanReportFilters = {}): Promise<BonanReport[]> {
  const conditions: string[] = [];
  const args: string[] = [];

  if (filters.report_type) {
    conditions.push("br.report_type = ?");
    args.push(filters.report_type);
  }
  if (filters.status) {
    conditions.push("br.status = ?");
    args.push(filters.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await turso.execute({
    sql: `SELECT br.*,
                 wo.work_order_number,
                 u.first_name || ' ' || u.last_name as creator_name
          FROM bonan_reports br
          LEFT JOIN work_orders wo ON br.work_order_id = wo.id
          LEFT JOIN users u ON br.created_by = u.id
          ${whereClause}
          ORDER BY br.report_date DESC, br.created_at DESC`,
    args,
  });

  return result.rows.map(mapRowToBonanReport);
}

export async function getBonanReportById(id: string): Promise<BonanReport | null> {
  const result = await turso.execute({
    sql: `SELECT br.*,
                 wo.work_order_number,
                 u.first_name || ' ' || u.last_name as creator_name
          FROM bonan_reports br
          LEFT JOIN work_orders wo ON br.work_order_id = wo.id
          LEFT JOIN users u ON br.created_by = u.id
          WHERE br.id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToBonanReport(result.rows[0]);
}

export async function createBonanReport(data: {
  report_type: BonanReportType;
  created_by: string;
  site?: BonanSite;
}): Promise<BonanReport> {
  const id = crypto.randomUUID().replace(/-/g, "");
  const site = data.site || "bonan_towers";

  const payload = data.report_type === "daily" ? createDefaultDailyReportPayload() : {};
  const normalizedDailyPayload =
    data.report_type === "daily"
      ? normalizeDailyReportPayload(payload)
      : null;
  const reportDate = normalizedDailyPayload ? normalizedDailyPayload.metadata.date : getTodayDate();
  const workOrderId = await createLinkedWorkOrder(data.report_type, data.created_by);

  await turso.execute({
    sql: `INSERT INTO bonan_reports (
            id, site, report_type, status, report_date, work_order_id, created_by, payload_json
          ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
    args: [
      id,
      site,
      data.report_type,
      reportDate,
      workOrderId,
      data.created_by,
      JSON.stringify(normalizedDailyPayload || payload),
    ],
  });

  const created = await getBonanReportById(id);
  if (!created) {
    throw new Error("Failed to load created Bonan report");
  }

  return created;
}

export async function updateBonanReport(
  id: string,
  data: {
    payload?: unknown;
    status?: BonanReportStatus;
  }
): Promise<BonanReport | null> {
  const existing = await getBonanReportById(id);
  if (!existing) return null;

  const nextStatus = data.status || existing.status;
  const nowIso = new Date().toISOString();

  let payloadToSave: DailyReportPayload | Record<string, unknown>;
  let reportDate = existing.report_date;

  if (existing.report_type === "daily") {
    payloadToSave = normalizeDailyReportPayload(data.payload ?? existing.payload);
    reportDate = payloadToSave.metadata.date || existing.report_date;
  } else {
    const candidate = data.payload ?? existing.payload;
    payloadToSave =
      candidate && typeof candidate === "object"
        ? (candidate as Record<string, unknown>)
        : {};
  }

  const lastAutosavedAt =
    nextStatus === "draft"
      ? nowIso
      : existing.last_autosaved_at;
  const submittedAt =
    nextStatus === "submitted"
      ? existing.submitted_at || nowIso
      : existing.submitted_at;

  await turso.execute({
    sql: `UPDATE bonan_reports
          SET payload_json = ?,
              status = ?,
              report_date = ?,
              last_autosaved_at = ?,
              submitted_at = ?,
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      JSON.stringify(payloadToSave),
      nextStatus,
      reportDate,
      lastAutosavedAt,
      submittedAt,
      id,
    ],
  });

  if (existing.report_type === "daily" && existing.work_order_id) {
    const dailyPayload = payloadToSave as DailyReportPayload;
    await turso.execute({
      sql: `UPDATE work_orders
            SET date = ?,
                time_received = ?,
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [reportDate, dailyPayload.metadata.start || null, existing.work_order_id],
    });
  }

  return getBonanReportById(id);
}

export async function getBonanAssociatedWorkOrders(reportId: string): Promise<BonanAssociatedWorkOrder[]> {
  const result = await turso.execute({
    sql: `SELECT brwo.*,
                 wo.work_order_number,
                 wo.date,
                 wo.priority,
                 wo.service_type,
                 wo.work_completed,
                 wo.description
          FROM bonan_report_work_orders brwo
          INNER JOIN work_orders wo ON wo.id = brwo.work_order_id
          WHERE brwo.bonan_report_id = ?
          ORDER BY brwo.created_at DESC`,
    args: [reportId],
  });

  return result.rows.map(mapRowToAssociatedWorkOrder);
}

export async function createAssociatedWorkOrderForBonanReport(data: {
  report_id: string;
  created_by: string;
  assigned_to?: string | null;
  description?: string;
  location?: string;
  area?: string;
  priority?: "emergency" | "high" | "normal" | "low";
  service_type?: "maintenance" | "repair" | "replace" | "inspection" | "preventive" | "cleaning" | "other";
}): Promise<BonanAssociatedWorkOrder | null> {
  const report = await getBonanReportById(data.report_id);
  if (!report) return null;

  const workOrderNumber = await generateWorkOrderNumber();
  const workOrderDescription =
    data.description?.trim() ||
    `Bonan Daily Walk-Through Follow-up (${report.report_date})`;

  const workOrder = await createWorkOrder({
    work_order_number: workOrderNumber,
    date: report.report_date || getTodayDate(),
    time_received: getCurrentTime(),
    company: "Bonan Towers",
    department: "Facilities",
    location: data.location || "Bonan Towers",
    area: data.area || undefined,
    priority: data.priority || "normal",
    service_type: data.service_type || "maintenance",
    description: workOrderDescription,
    assigned_to: data.assigned_to || undefined,
    created_by: data.created_by,
  });

  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO bonan_report_work_orders (id, bonan_report_id, work_order_id, created_by)
          VALUES (?, ?, ?, ?)`,
    args: [id, data.report_id, workOrder.id, data.created_by],
  });

  const result = await turso.execute({
    sql: `SELECT brwo.*,
                 wo.work_order_number,
                 wo.date,
                 wo.priority,
                 wo.service_type,
                 wo.work_completed,
                 wo.description
          FROM bonan_report_work_orders brwo
          INNER JOIN work_orders wo ON wo.id = brwo.work_order_id
          WHERE brwo.id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToAssociatedWorkOrder(result.rows[0]);
}

export async function deleteBonanReport(id: string): Promise<boolean> {
  const existing = await getBonanReportById(id);
  if (!existing) return false;

  await turso.execute({
    sql: `DELETE FROM bonan_reports WHERE id = ?`,
    args: [id],
  });

  if (existing.work_order_id) {
    await turso.execute({
      sql: `DELETE FROM work_orders WHERE id = ?`,
      args: [existing.work_order_id],
    });
  }

  return true;
}
