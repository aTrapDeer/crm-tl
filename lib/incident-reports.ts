import { turso } from "./turso";
import { ensureBonanClientSchema } from "./bonan-client";

export type IncidentReportStatus = "open" | "in_progress" | "closed";

export interface IncidentReport {
  id: string;
  bonan_report_id: string;
  report_number: string;
  report_date: string;
  section_key: string | null;
  section_name: string;
  incident_time: string | null;
  location: string | null;
  system_area: string | null;
  description: string;
  actions_taken: string | null;
  work_order_or_vendor: string | null;
  status: IncidentReportStatus;
  site: "bonan_towers" | null;
  client_visible_revision: number;
  publication_status: "draft" | "published";
  published_at: string | null;
  created_by: string | null;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

function mapRowToIncidentReport(row: Record<string, unknown>): IncidentReport {
  return {
    id: row.id as string,
    bonan_report_id: row.bonan_report_id as string,
    report_number: row.report_number as string,
    report_date: row.report_date as string,
    section_key: row.section_key as string | null,
    section_name: row.section_name as string,
    incident_time: row.incident_time as string | null,
    location: row.location as string | null,
    system_area: row.system_area as string | null,
    description: row.description as string,
    actions_taken: row.actions_taken as string | null,
    work_order_or_vendor: row.work_order_or_vendor as string | null,
    status: row.status as IncidentReportStatus,
    site: (row.site as IncidentReport["site"]) || null,
    client_visible_revision: Number(row.client_visible_revision || 1),
    publication_status: row.publication_status as IncidentReport["publication_status"],
    published_at: row.published_at as string | null,
    created_by: row.created_by as string | null,
    creator_name: row.creator_name as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function generateIncidentReportNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `IR-${today}-`;

  const result = await turso.execute({
    sql: `SELECT report_number
          FROM incident_reports
          WHERE report_number LIKE ?
          ORDER BY report_number DESC
          LIMIT 1`,
    args: [`${prefix}%`],
  });

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].report_number as string;
    const lastSequence = parseInt(lastNumber.split("-").pop() || "0", 10);
    sequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
  }

  return `${prefix}${sequence.toString().padStart(3, "0")}`;
}

export async function getIncidentReports(): Promise<IncidentReport[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute(`
    SELECT ir.*,
           u.first_name || ' ' || u.last_name as creator_name
    FROM incident_reports ir
    LEFT JOIN users u ON ir.created_by = u.id
    ORDER BY ir.created_at DESC
  `);

  return result.rows.map(mapRowToIncidentReport);
}

export interface IncidentReportFilters {
  bonan_report_id?: string;
  statuses?: IncidentReportStatus[];
  publication_status?: IncidentReport["publication_status"];
  site?: IncidentReport["site"];
  date_from?: string;
  date_to?: string;
}

export async function searchIncidentReports(filters: IncidentReportFilters): Promise<IncidentReport[]> {
  await ensureBonanClientSchema();
  const conditions: string[] = [];
  const args: string[] = [];

  if (filters.bonan_report_id) {
    conditions.push("ir.bonan_report_id = ?");
    args.push(filters.bonan_report_id);
  }
  if (filters.publication_status) {
    conditions.push("ir.publication_status = ?");
    args.push(filters.publication_status);
  }
  if (filters.statuses && filters.statuses.length > 0) {
    conditions.push(`ir.status IN (${filters.statuses.map(() => "?").join(", ")})`);
    args.push(...filters.statuses);
  }
  if (filters.site) {
    conditions.push("ir.site = ?");
    args.push(filters.site);
  }
  if (filters.date_from) {
    conditions.push("ir.report_date >= ?");
    args.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push("ir.report_date <= ?");
    args.push(filters.date_to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await turso.execute({
    sql: `SELECT ir.*,
                 u.first_name || ' ' || u.last_name as creator_name
          FROM incident_reports ir
          LEFT JOIN users u ON ir.created_by = u.id
          ${whereClause}
          ORDER BY ir.created_at DESC`,
    args,
  });

  return result.rows.map(mapRowToIncidentReport);
}

export async function getIncidentReportById(id: string): Promise<IncidentReport | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT ir.*,
                 u.first_name || ' ' || u.last_name as creator_name
          FROM incident_reports ir
          LEFT JOIN users u ON ir.created_by = u.id
          WHERE ir.id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToIncidentReport(result.rows[0]);
}

export async function getIncidentReportsForBonanReport(reportId: string): Promise<IncidentReport[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT ir.*,
                 u.first_name || ' ' || u.last_name as creator_name
          FROM incident_reports ir
          LEFT JOIN users u ON ir.created_by = u.id
          WHERE ir.bonan_report_id = ?
          ORDER BY ir.created_at DESC`,
    args: [reportId],
  });

  return result.rows.map(mapRowToIncidentReport);
}

export async function createIncidentReport(data: {
  bonan_report_id: string;
  report_date: string;
  section_key?: string;
  section_name: string;
  incident_time?: string;
  location?: string;
  system_area?: string;
  description: string;
  actions_taken?: string;
  work_order_or_vendor?: string;
  status?: IncidentReportStatus;
  site?: IncidentReport["site"];
  publication_status?: IncidentReport["publication_status"];
  published_at?: string;
  created_by?: string;
}): Promise<IncidentReport> {
  await ensureBonanClientSchema();
  const id = crypto.randomUUID().replace(/-/g, "");
  const reportNumber = await generateIncidentReportNumber();

  await turso.execute({
    sql: `INSERT INTO incident_reports (
            id,
            bonan_report_id,
            report_number,
            report_date,
            section_key,
            section_name,
            incident_time,
            location,
            system_area,
            description,
            actions_taken,
            work_order_or_vendor,
            status,
            site,
            client_visible_revision,
            publication_status,
            published_at,
            created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.bonan_report_id,
      reportNumber,
      data.report_date,
      data.section_key?.trim() || null,
      data.section_name.trim() || "General Incident",
      data.incident_time?.trim() || null,
      data.location?.trim() || null,
      data.system_area?.trim() || null,
      data.description.trim(),
      data.actions_taken?.trim() || null,
      data.work_order_or_vendor?.trim() || null,
      data.status || "open",
      data.site || null,
      1,
      data.publication_status || "draft",
      data.published_at || null,
      data.created_by || null,
    ],
  });

  return (await getIncidentReportById(id))!;
}

export async function updateIncidentReport(
  id: string,
  data: Partial<Omit<IncidentReport, "id" | "bonan_report_id" | "report_number" | "created_by" | "created_at" | "updated_at">>
): Promise<IncidentReport | null> {
  await ensureBonanClientSchema();
  const updates: string[] = [];
  const args: (string | null)[] = [];

  if (data.report_date !== undefined) {
    updates.push("report_date = ?");
    args.push(data.report_date);
  }
  if (data.section_key !== undefined) {
    updates.push("section_key = ?");
    args.push(data.section_key);
  }
  if (data.section_name !== undefined) {
    updates.push("section_name = ?");
    args.push(data.section_name);
  }
  if (data.incident_time !== undefined) {
    updates.push("incident_time = ?");
    args.push(data.incident_time);
  }
  if (data.location !== undefined) {
    updates.push("location = ?");
    args.push(data.location);
  }
  if (data.system_area !== undefined) {
    updates.push("system_area = ?");
    args.push(data.system_area);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    args.push(data.description);
  }
  if (data.actions_taken !== undefined) {
    updates.push("actions_taken = ?");
    args.push(data.actions_taken);
  }
  if (data.work_order_or_vendor !== undefined) {
    updates.push("work_order_or_vendor = ?");
    args.push(data.work_order_or_vendor);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    args.push(data.status);
  }
  if (data.site !== undefined) {
    updates.push("site = ?");
    args.push(data.site);
  }
  if (data.publication_status !== undefined) {
    updates.push("publication_status = ?");
    args.push(data.publication_status);
  }
  if (data.published_at !== undefined) {
    updates.push("published_at = ?");
    args.push(data.published_at);
  }

  if (updates.length === 0) {
    return getIncidentReportById(id);
  }

  updates.push("client_visible_revision = COALESCE(client_visible_revision, 1) + 1");
  updates.push("updated_at = datetime('now')");
  args.push(id);

  await turso.execute({
    sql: `UPDATE incident_reports
          SET ${updates.join(", ")}
          WHERE id = ?`,
    args,
  });

  return getIncidentReportById(id);
}
