import { turso } from "./turso";
import { ensureBonanClientSchema } from "./bonan-client";
import {
  createDefaultDailyReportPayload,
  normalizeDailyReportPayload,
  type BonanReportStatus,
  type BonanReportType,
  type BonanSite,
  type DailyReportPayload,
} from "./bonan-types";
import {
  createDefaultWeeklyReportPayload,
  createDefaultMonthlyReportPayload,
  normalizeWeeklyReportPayload,
  normalizeMonthlyReportPayload,
  type WeeklyReportPayload,
  type MonthlyReportPayload,
} from "./bonan-period-payloads";
import { createWorkOrder, generateWorkOrderNumber } from "./work-orders";
import {
  getDaysInIsoMonth,
  getMonthEndDate,
  getMonthStartDate,
  getUsCentralDate,
  getUsCentralTimeHHMM,
  getWeekEndSaturday,
  getWeekStartSunday,
} from "./us-central-time";

export interface BonanReport {
  id: string;
  site: BonanSite;
  report_type: BonanReportType;
  status: BonanReportStatus;
  report_date: string;
  work_order_id: string | null;
  work_order_number?: string;
  client_visible_revision: number;
  created_by: string | null;
  creator_name?: string;
  payload: DailyReportPayload | WeeklyReportPayload | MonthlyReportPayload | Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string | null;
  submitted_at: string | null;
}

export interface BonanLinkedReportSummary {
  id: string;
  report_date: string;
  status: BonanReportStatus;
  work_order_number: string | null;
}

export interface BonanCollectiveSummary {
  report_id: string;
  report_type: BonanReportType;
  period_start: string;
  period_end: string;
  period_days: number;
  daily_reports: {
    due: number;
    total: number;
    draft: number;
    submitted: number;
    linked: BonanLinkedReportSummary[];
  };
  weekly_reports: {
    total: number;
    draft: number;
    submitted: number;
    linked: BonanLinkedReportSummary[];
  };
  incidents: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
  };
  work_orders: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    emergency: number;
    high: number;
  };
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
  area: string | null;
  priority: "emergency" | "high" | "normal" | "low";
  service_type: "maintenance" | "repair" | "replace" | "inspection" | "preventive" | "cleaning" | "other";
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  description: string;
  created_at: string;
}

export interface BonanRelatedIncidentReport {
  id: string;
  report_number: string;
  report_date: string;
  section_name: string;
  location: string | null;
  status: "open" | "in_progress" | "closed";
  publication_status: "draft" | "published";
  description: string;
}

export interface BonanRelatedWorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  location: string | null;
  area: string | null;
  priority: "emergency" | "high" | "normal" | "low";
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  publication_status: "draft" | "published";
  description: string;
}

export interface BonanRelatedItems {
  report_id: string;
  report_type: BonanReportType;
  period_start: string;
  period_end: string;
  incident_reports: BonanRelatedIncidentReport[];
  work_orders: BonanRelatedWorkOrder[];
}

function parsePayload(
  type: BonanReportType,
  payloadJson: string | null,
  reportDate?: string
): DailyReportPayload | WeeklyReportPayload | MonthlyReportPayload | Record<string, unknown> {
  if (!payloadJson) {
    if (type === "daily") return createDefaultDailyReportPayload();
    if (type === "weekly") return createDefaultWeeklyReportPayload(reportDate || getUsCentralDate());
    if (type === "monthly") return createDefaultMonthlyReportPayload(reportDate || getUsCentralDate());
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (type === "daily") {
      return normalizeDailyReportPayload(parsed);
    }
    if (type === "weekly") {
      return normalizeWeeklyReportPayload(parsed, reportDate || getUsCentralDate());
    }
    if (type === "monthly") {
      return normalizeMonthlyReportPayload(parsed, reportDate || getUsCentralDate());
    }
    return {};
  } catch {
    if (type === "daily") return createDefaultDailyReportPayload();
    if (type === "weekly") return createDefaultWeeklyReportPayload(reportDate || getUsCentralDate());
    if (type === "monthly") return createDefaultMonthlyReportPayload(reportDate || getUsCentralDate());
    return {};
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
    client_visible_revision: Number(row.client_visible_revision || 1),
    created_by: row.created_by as string | null,
    creator_name: row.creator_name as string | undefined,
    payload: parsePayload(reportType, row.payload_json as string | null, row.report_date as string | undefined),
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

function normalizeReportDateForType(reportType: BonanReportType, reportDate?: string): string {
  const baseDate = reportDate || getTodayDate();
  if (reportType === "weekly") return getWeekStartSunday(baseDate);
  if (reportType === "monthly") return getMonthStartDate(baseDate);
  return baseDate;
}

function mapRowToAssociatedWorkOrder(row: Record<string, unknown>): BonanAssociatedWorkOrder {
  return {
    id: row.id as string,
    bonan_report_id: row.bonan_report_id as string,
    work_order_id: row.work_order_id as string,
    work_order_number: row.work_order_number as string,
    date: row.date as string,
    area: row.area as string | null,
    priority: row.priority as BonanAssociatedWorkOrder["priority"],
    service_type: row.service_type as BonanAssociatedWorkOrder["service_type"],
    work_completed: row.work_completed as BonanAssociatedWorkOrder["work_completed"],
    description: row.description as string,
    created_at: row.created_at as string,
  };
}

export async function getBonanReportByDate(data: {
  report_type: BonanReportType;
  report_date: string;
  site?: BonanSite;
}): Promise<BonanReport | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT br.*,
                 wo.work_order_number,
                 u.first_name || ' ' || u.last_name as creator_name
          FROM bonan_reports br
          LEFT JOIN work_orders wo ON br.work_order_id = wo.id
          LEFT JOIN users u ON br.created_by = u.id
          WHERE br.site = ?
            AND br.report_type = ?
            AND br.report_date = ?
          ORDER BY br.created_at DESC
          LIMIT 1`,
    args: [data.site || "bonan_towers", data.report_type, data.report_date],
  });

  if (result.rows.length === 0) return null;
  return mapRowToBonanReport(result.rows[0]);
}

export async function getBonanReports(filters: BonanReportFilters = {}): Promise<BonanReport[]> {
  await ensureBonanClientSchema();
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
  await ensureBonanClientSchema();
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
  report_date?: string;
}): Promise<BonanReport> {
  await ensureBonanClientSchema();
  const id = crypto.randomUUID().replace(/-/g, "");
  const site = data.site || "bonan_towers";
  const reportDate = normalizeReportDateForType(data.report_type, data.report_date);

  let payload: DailyReportPayload | WeeklyReportPayload | MonthlyReportPayload | Record<string, unknown>;

  if (data.report_type === "daily") {
    const dailyPayload = createDefaultDailyReportPayload();
    dailyPayload.metadata.date = reportDate;
    dailyPayload.fridgeLogs = dailyPayload.fridgeLogs.map((row) => ({
      ...row,
      date: reportDate,
    }));
    payload = normalizeDailyReportPayload(dailyPayload);
  } else if (data.report_type === "weekly") {
    payload = createDefaultWeeklyReportPayload(reportDate);
  } else if (data.report_type === "monthly") {
    payload = createDefaultMonthlyReportPayload(reportDate);
  } else {
    payload = {};
  }

  await turso.execute({
    sql: `INSERT INTO bonan_reports (
            id, site, report_type, status, report_date, work_order_id, client_visible_revision, created_by, payload_json
          ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    args: [
      id,
      site,
      data.report_type,
      reportDate,
      null,
      1,
      data.created_by,
      JSON.stringify(payload),
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
  await ensureBonanClientSchema();
  const existing = await getBonanReportById(id);
  if (!existing) return null;

  const nextStatus = data.status || existing.status;
  const nowIso = new Date().toISOString();

  let payloadToSave: DailyReportPayload | WeeklyReportPayload | MonthlyReportPayload | Record<string, unknown>;
  let reportDate = existing.report_date;

  if (existing.report_type === "daily") {
    payloadToSave = normalizeDailyReportPayload(data.payload ?? existing.payload);
    reportDate = normalizeReportDateForType(
      "daily",
      (payloadToSave as DailyReportPayload).metadata.date || existing.report_date
    );
  } else if (existing.report_type === "weekly") {
    payloadToSave = normalizeWeeklyReportPayload(data.payload ?? existing.payload, existing.report_date);
    reportDate = normalizeReportDateForType(
      "weekly",
      (payloadToSave as WeeklyReportPayload).metadata.weekStart || existing.report_date
    );
  } else if (existing.report_type === "monthly") {
    payloadToSave = normalizeMonthlyReportPayload(data.payload ?? existing.payload, existing.report_date);
    reportDate = normalizeReportDateForType(
      "monthly",
      (payloadToSave as MonthlyReportPayload).metadata.monthStart || existing.report_date
    );
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
              client_visible_revision = COALESCE(client_visible_revision, 1) + 1,
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

  if (existing.work_order_id) {
    const timeReceived =
      existing.report_type === "daily"
        ? (payloadToSave as DailyReportPayload).metadata.start || null
        : null;
    await turso.execute({
      sql: `UPDATE work_orders
            SET date = ?,
                time_received = ?,
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [reportDate, timeReceived, existing.work_order_id],
    });
  }

  return getBonanReportById(id);
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isIsoWeekday(isoDate: string): boolean {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return false;
  const day = parsed.getUTCDay();
  return day >= 1 && day <= 5;
}

function countWeekdaysInRange(startIsoDate: string, endIsoDate: string): number {
  const start = new Date(`${startIsoDate}T00:00:00Z`);
  const end = new Date(`${endIsoDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return 0;

  let weekdays = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) weekdays += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return weekdays;
}

function getReportPeriod(report: BonanReport): { start: string; end: string; days: number } {
  if (report.report_type === "weekly") {
    return {
      start: getWeekStartSunday(report.report_date),
      end: getWeekEndSaturday(report.report_date),
      days: 7,
    };
  }

  if (report.report_type === "monthly") {
    const start = getMonthStartDate(report.report_date);
    return {
      start,
      end: getMonthEndDate(report.report_date),
      days: getDaysInIsoMonth(start),
    };
  }

  return {
    start: report.report_date,
    end: report.report_date,
    days: 1,
  };
}

export async function getBonanCollectiveSummary(reportId: string): Promise<BonanCollectiveSummary | null> {
  await ensureBonanClientSchema();
  const report = await getBonanReportById(reportId);
  if (!report) return null;

  const period = getReportPeriod(report);

  const [dailyReportsResult, weeklyReportsResult, incidentsResult, workOrdersResult] = await Promise.all([
    turso.execute({
      sql: `SELECT br.id,
                   br.report_date,
                   br.status,
                   wo.work_order_number
            FROM bonan_reports br
            LEFT JOIN work_orders wo ON wo.id = br.work_order_id
            WHERE br.site = 'bonan_towers'
              AND br.report_type = 'daily'
              AND br.report_date BETWEEN ? AND ?
            ORDER BY br.report_date ASC, br.created_at ASC`,
      args: [period.start, period.end],
    }),
    turso.execute({
      sql: `SELECT br.id,
                   br.report_date,
                   br.status,
                   wo.work_order_number
            FROM bonan_reports br
            LEFT JOIN work_orders wo ON wo.id = br.work_order_id
            WHERE br.site = 'bonan_towers'
              AND br.report_type = 'weekly'
              AND br.report_date BETWEEN ? AND ?
            ORDER BY br.report_date ASC, br.created_at ASC`,
      args: [period.start, period.end],
    }),
    turso.execute({
      sql: `SELECT
              COUNT(*) as total,
              SUM(CASE WHEN ir.status = 'open' THEN 1 ELSE 0 END) as open_count,
              SUM(CASE WHEN ir.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
              SUM(CASE WHEN ir.status = 'closed' THEN 1 ELSE 0 END) as closed_count
            FROM incident_reports ir
            INNER JOIN bonan_reports br ON br.id = ir.bonan_report_id
            WHERE br.site = 'bonan_towers'
              AND ir.report_date BETWEEN ? AND ?`,
      args: [period.start, period.end],
    }),
    turso.execute({
      sql: `WITH linked_work_orders AS (
              SELECT wo.id, wo.work_completed, wo.priority
              FROM bonan_reports br
              INNER JOIN work_orders wo ON wo.id = br.work_order_id
              WHERE br.site = 'bonan_towers'
                AND br.report_date BETWEEN ? AND ?
              UNION
              SELECT wo.id, wo.work_completed, wo.priority
              FROM bonan_report_work_orders brwo
              INNER JOIN bonan_reports br ON br.id = brwo.bonan_report_id
              INNER JOIN work_orders wo ON wo.id = brwo.work_order_id
              WHERE br.site = 'bonan_towers'
                AND br.report_date BETWEEN ? AND ?
            )
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN work_completed = 'pending' THEN 1 ELSE 0 END) as pending_count,
              SUM(CASE WHEN work_completed = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
              SUM(CASE WHEN work_completed = 'completed' THEN 1 ELSE 0 END) as completed_count,
              SUM(CASE WHEN work_completed = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
              SUM(CASE WHEN priority = 'emergency' THEN 1 ELSE 0 END) as emergency_count,
              SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_count
            FROM linked_work_orders`,
      args: [period.start, period.end, period.start, period.end],
    }),
  ]);

  const dailyReports = dailyReportsResult.rows.map((row) => ({
    id: row.id as string,
    report_date: row.report_date as string,
    status: row.status as BonanReportStatus,
    work_order_number: (row.work_order_number as string | null) || null,
  }));

  const weeklyReports = weeklyReportsResult.rows.map((row) => ({
    id: row.id as string,
    report_date: row.report_date as string,
    status: row.status as BonanReportStatus,
    work_order_number: (row.work_order_number as string | null) || null,
  }));

  const complianceDailyReports =
    report.report_type === "daily"
      ? dailyReports
      : dailyReports.filter((row) => isIsoWeekday(row.report_date));
  const complianceDailyDue = report.report_type === "daily"
    ? 1
    : countWeekdaysInRange(period.start, period.end);

  const incidentsRow = incidentsResult.rows[0] || {};
  const workOrdersRow = workOrdersResult.rows[0] || {};

  return {
    report_id: report.id,
    report_type: report.report_type,
    period_start: period.start,
    period_end: period.end,
    period_days: period.days,
    daily_reports: {
      due: complianceDailyDue,
      total: complianceDailyReports.length,
      draft: complianceDailyReports.filter((row) => row.status === "draft").length,
      submitted: complianceDailyReports.filter((row) => row.status === "submitted").length,
      linked: dailyReports,
    },
    weekly_reports: {
      total: weeklyReports.length,
      draft: weeklyReports.filter((row) => row.status === "draft").length,
      submitted: weeklyReports.filter((row) => row.status === "submitted").length,
      linked: weeklyReports,
    },
    incidents: {
      total: asNumber(incidentsRow.total),
      open: asNumber(incidentsRow.open_count),
      in_progress: asNumber(incidentsRow.in_progress_count),
      closed: asNumber(incidentsRow.closed_count),
    },
    work_orders: {
      total: asNumber(workOrdersRow.total),
      pending: asNumber(workOrdersRow.pending_count),
      in_progress: asNumber(workOrdersRow.in_progress_count),
      completed: asNumber(workOrdersRow.completed_count),
      cancelled: asNumber(workOrdersRow.cancelled_count),
      emergency: asNumber(workOrdersRow.emergency_count),
      high: asNumber(workOrdersRow.high_count),
    },
  };
}

export async function getBonanRelatedItems(reportId: string): Promise<BonanRelatedItems | null> {
  await ensureBonanClientSchema();
  const report = await getBonanReportById(reportId);
  if (!report) return null;

  const period = getReportPeriod(report);

  const [incidentsResult, workOrdersResult] = await Promise.all([
    turso.execute({
      sql: `SELECT ir.id,
                   ir.report_number,
                   ir.report_date,
                   ir.section_name,
                   ir.location,
                   ir.status,
                   ir.publication_status,
                   ir.description
            FROM incident_reports ir
            INNER JOIN bonan_reports br ON br.id = ir.bonan_report_id
            WHERE br.site = 'bonan_towers'
              AND ir.report_date BETWEEN ? AND ?
            ORDER BY ir.report_date DESC, ir.created_at DESC`,
      args: [period.start, period.end],
    }),
    turso.execute({
      sql: `WITH linked_work_order_ids AS (
              SELECT wo.id AS work_order_id
              FROM bonan_reports br
              INNER JOIN work_orders wo ON wo.id = br.work_order_id
              WHERE br.site = 'bonan_towers'
                AND br.report_date BETWEEN ? AND ?
              UNION
              SELECT wo.id AS work_order_id
              FROM bonan_report_work_orders brwo
              INNER JOIN bonan_reports br ON br.id = brwo.bonan_report_id
              INNER JOIN work_orders wo ON wo.id = brwo.work_order_id
              WHERE br.site = 'bonan_towers'
                AND br.report_date BETWEEN ? AND ?
            )
            SELECT wo.id,
                   wo.work_order_number,
                   wo.date,
                   wo.location,
                   wo.area,
                   wo.priority,
                   wo.work_completed,
                   wo.publication_status,
                   wo.description
            FROM linked_work_order_ids linked
            INNER JOIN work_orders wo ON wo.id = linked.work_order_id
            ORDER BY wo.date DESC, wo.created_at DESC`,
      args: [period.start, period.end, period.start, period.end],
    }),
  ]);

  const incidentReports = incidentsResult.rows.map((row) => ({
    id: row.id as string,
    report_number: row.report_number as string,
    report_date: row.report_date as string,
    section_name: row.section_name as string,
    location: row.location as string | null,
    status: row.status as BonanRelatedIncidentReport["status"],
    publication_status: row.publication_status as BonanRelatedIncidentReport["publication_status"],
    description: row.description as string,
  }));

  const workOrders = workOrdersResult.rows.map((row) => ({
    id: row.id as string,
    work_order_number: row.work_order_number as string,
    date: row.date as string,
    location: row.location as string | null,
    area: row.area as string | null,
    priority: row.priority as BonanRelatedWorkOrder["priority"],
    work_completed: row.work_completed as BonanRelatedWorkOrder["work_completed"],
    publication_status: row.publication_status as BonanRelatedWorkOrder["publication_status"],
    description: row.description as string,
  }));

  return {
    report_id: report.id,
    report_type: report.report_type,
    period_start: period.start,
    period_end: period.end,
    incident_reports: incidentReports,
    work_orders: workOrders,
  };
}

export async function getBonanAssociatedWorkOrders(reportId: string): Promise<BonanAssociatedWorkOrder[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT brwo.*,
                 wo.work_order_number,
                 wo.date,
                 wo.area,
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
  await ensureBonanClientSchema();
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
    site: "bonan_towers",
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
                 wo.area,
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
  await ensureBonanClientSchema();
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
