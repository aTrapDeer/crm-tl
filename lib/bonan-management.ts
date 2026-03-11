import { ensureBonanClientSchema } from "./bonan-client";
import { getBonanReportByDate, getBonanReportById, type BonanReport } from "./bonan-reports";
import { createDefaultDailyReportPayload, normalizeDailyReportPayload } from "./bonan-types";
import { createIncidentReport, type IncidentReport, type IncidentReportStatus } from "./incident-reports";
import { turso } from "./turso";
import { getUsCentralTimeHHMM } from "./us-central-time";
import { createWorkOrder, generateWorkOrderNumber, type WorkOrder } from "./work-orders";

function normalizeOptionalString(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export async function resolveBonanAnchorReportForDate(data: {
  report_date: string;
  created_by: string;
}): Promise<BonanReport> {
  const dailyReport = await getBonanReportByDate({
    report_type: "daily",
    report_date: data.report_date,
    site: "bonan_towers",
  });
  if (dailyReport) return dailyReport;

  const id = crypto.randomUUID().replace(/-/g, "");
  const payload = createDefaultDailyReportPayload();
  payload.metadata.date = data.report_date;
  payload.fridgeLogs = payload.fridgeLogs.map((row) => ({
    ...row,
    date: data.report_date,
  }));

  await turso.execute({
    sql: `INSERT INTO bonan_reports (
            id, site, report_type, status, report_date, client_visible_revision, created_by, payload_json
          ) VALUES (?, 'bonan_towers', 'daily', 'draft', ?, 1, ?, ?)`,
    args: [id, data.report_date, data.created_by, JSON.stringify(normalizeDailyReportPayload(payload))],
  });

  const createdReport = await getBonanReportById(id);
  if (!createdReport) {
    throw new Error("Failed to create Bonan event anchor report");
  }

  return createdReport;
}

export async function createBonanIsolatedWorkOrder(data: {
  report_date: string;
  created_by: string;
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
  assigned_to?: string | null;
  scheduled_date?: string;
  scheduled_time?: string;
  project_id?: string;
}): Promise<{ anchorReport: BonanReport; workOrder: WorkOrder }> {
  await ensureBonanClientSchema();

  const anchorReport = await resolveBonanAnchorReportForDate({
    report_date: data.report_date,
    created_by: data.created_by,
  });

  const workOrder = await createWorkOrder({
    work_order_number: await generateWorkOrderNumber(),
    date: data.report_date,
    time_received: getUsCentralTimeHHMM(),
    phone: normalizeOptionalString(data.phone),
    email: normalizeOptionalString(data.email),
    company: normalizeOptionalString(data.company) || "Bonan Towers",
    department: normalizeOptionalString(data.department) || "Facilities",
    location: normalizeOptionalString(data.location) || "Bonan Towers",
    unit: normalizeOptionalString(data.unit),
    area: normalizeOptionalString(data.area),
    access_needed: normalizeOptionalString(data.access_needed),
    preferred_entry_time: normalizeOptionalString(data.preferred_entry_time),
    priority: data.priority || "normal",
    service_type: data.service_type || "maintenance",
    description: data.description.trim(),
    assigned_to: data.assigned_to || undefined,
    scheduled_date: normalizeOptionalString(data.scheduled_date),
    scheduled_time: normalizeOptionalString(data.scheduled_time),
    project_id: normalizeOptionalString(data.project_id),
    site: "bonan_towers",
    created_by: data.created_by,
  });

  await turso.execute({
    sql: `INSERT INTO bonan_report_work_orders (id, bonan_report_id, work_order_id, created_by)
          VALUES (?, ?, ?, ?)`,
    args: [crypto.randomUUID().replace(/-/g, ""), anchorReport.id, workOrder.id, data.created_by],
  });

  return {
    anchorReport,
    workOrder,
  };
}

export async function createBonanIsolatedIncidentReport(data: {
  report_date: string;
  created_by: string;
  section_name?: string;
  incident_time?: string;
  location?: string;
  system_area?: string;
  description: string;
  actions_taken?: string;
  work_order_or_vendor?: string;
  status?: IncidentReportStatus;
}): Promise<{ anchorReport: BonanReport; incidentReport: IncidentReport }> {
  await ensureBonanClientSchema();

  const anchorReport = await resolveBonanAnchorReportForDate({
    report_date: data.report_date,
    created_by: data.created_by,
  });

  const incidentReport = await createIncidentReport({
    bonan_report_id: anchorReport.id,
    report_date: data.report_date,
    section_name: normalizeOptionalString(data.section_name) || "General Incident",
    incident_time: normalizeOptionalString(data.incident_time),
    location: normalizeOptionalString(data.location) || "Bonan Towers",
    system_area: normalizeOptionalString(data.system_area),
    description: data.description.trim(),
    actions_taken: normalizeOptionalString(data.actions_taken),
    work_order_or_vendor: normalizeOptionalString(data.work_order_or_vendor),
    status: data.status || "open",
    site: "bonan_towers",
    created_by: data.created_by,
  });

  return {
    anchorReport,
    incidentReport,
  };
}
