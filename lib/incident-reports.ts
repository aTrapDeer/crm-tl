import { turso } from "./turso";

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
  const result = await turso.execute(`
    SELECT ir.*,
           u.first_name || ' ' || u.last_name as creator_name
    FROM incident_reports ir
    LEFT JOIN users u ON ir.created_by = u.id
    ORDER BY ir.created_at DESC
  `);

  return result.rows.map(mapRowToIncidentReport);
}

export async function getIncidentReportById(id: string): Promise<IncidentReport | null> {
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
  created_by?: string;
}): Promise<IncidentReport> {
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
            created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      data.created_by || null,
    ],
  });

  return (await getIncidentReportById(id))!;
}

export async function updateIncidentReport(
  id: string,
  data: Partial<Omit<IncidentReport, "id" | "bonan_report_id" | "report_number" | "created_by" | "created_at" | "updated_at">>
): Promise<IncidentReport | null> {
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

  if (updates.length === 0) {
    return getIncidentReportById(id);
  }

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
