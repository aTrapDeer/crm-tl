import { getUsCentralDate, getUsCentralTimeHHMM } from "./us-central-time";

export type BonanSite = "bonan_towers";
export type BonanReportType = "daily" | "weekly" | "monthly";
export type BonanReportStatus = "draft" | "submitted";
export type TowerSelection = "north" | "south" | "both";
export type AreaStatus = "O" | "D" | "NA";
export type WithinTarget = "Y" | "N";

export interface DailyReportMetadata {
  date: string;
  start: string;
  end: string;
  inspector: string;
  towers: TowerSelection;
  weather: string;
  shift: string;
  supervisorReview: string;
  workOrdersCreated: string;
  signature: string;
}

export interface CoverageMatrixRow {
  area: string;
  restrooms: AreaStatus;
  fountain: AreaStatus;
  elecCloset: AreaStatus;
  notes: string;
  initials: string;
}

export interface ChecklistItem {
  label: string;
  checked: boolean;
  notes: string;
}

export interface TemperatureReadings {
  pumpRoom: string;
  boilerRoom: string;
  atrium: string;
}

export interface IncidentEntry {
  time: string;
  systemArea: string;
  description: string;
  actionsTaken: string;
  workOrderOrVendor: string;
}

export interface FridgeTempEntry {
  date: string;
  time: string;
  tempF: string;
  withinTarget: WithinTarget;
  correctiveAction: string;
  initials: string;
}

export interface FireAlarmLogMeta {
  dateRange: string;
  preparedBy: string;
  supervisorReview: string;
  signature: string;
}

export interface FireAlarmLogEntry {
  date: string;
  time: string;
  panel: string;
  type: string;
  messageZone: string;
  actionTaken: string;
  cleared: boolean;
  workOrderNumber: string;
}

export interface DailyReportPayload {
  metadata: DailyReportMetadata;
  coverageMatrix: CoverageMatrixRow[];
  commonAreas: ChecklistItem[];
  temperatures: TemperatureReadings;
  riskControls: ChecklistItem[];
  incidents: IncidentEntry[];
  incidentDocumentationReference: string;
  fridgeLogs: FridgeTempEntry[];
  fireAlarmMeta: FireAlarmLogMeta;
  fireAlarmEntries: FireAlarmLogEntry[];
}

export const COVERAGE_MATRIX_AREAS = [
  "North - Floor 1",
  "North - Floor 2",
  "North - Floor 3",
  "North - Floor 4",
  "North - Floor 5",
  "North - Floor 6",
  "South - Floor 1",
  "South - Floor 2",
  "South - Floor 3",
  "South - Floor 4",
  "South - Floor 5",
  "South - Floor 6",
];

export const COMMON_AREA_ITEMS = [
  "Atrium (Floors 1-2): floors dry; no trip hazards; railings secure; lighting OK; walls/paint checked",
  "Kitchenette/Common Area: sink and supply lines dry; GFCI outlets normal; coffee/snack area clean",
  "Retail Fridge: no leaks/condensation on floor; temperature logged per Temp Log sheet",
  "Conference Room (Common Area): cleanliness, furniture condition, doors/locks, A/V present and secured",
];

export const RISK_CONTROL_ITEMS = [
  "Exterior/parking: hazards removed or flagged; lighting outages recorded; entrances clear",
  "Egress routes: corridors and stairwells clear; fire doors not propped; exit signs illuminated",
  "Sprinkler Pump Room: secure; no leaks; gauges normal; pump controller normal; housekeeping compliant",
  "Main Fire Alarm Panel (in Pump Room): panel shows NORMAL (no alarm/trouble/supervisory)",
  "Fire Alarm Sub-Panel (outside Boiler Room): NORMAL indicators; no trouble conditions",
  "Mechanical/Boiler Room: secure; no leaks/odors; ventilation/combustion air unobstructed; no active alarms",
  "Elevators - North Tower (Car 1 & 2): ride quality OK; doors operate; car lights/fan OK; cab clean",
  "Elevators - South Tower (Car 1 & 2): ride quality OK; doors operate; car lights/fan OK; cab clean",
  "Stairwell doors: close and latch; panic hardware functional; landings clear",
];

function getCurrentDate(now = new Date()): string {
  return getUsCentralDate(now);
}

function getCurrentTime(now = new Date()): string {
  return getUsCentralTimeHHMM(now);
}

function createCoverageRow(area: string): CoverageMatrixRow {
  return {
    area,
    restrooms: "NA",
    fountain: "NA",
    elecCloset: "NA",
    notes: "",
    initials: "",
  };
}

function createChecklistItem(label: string): ChecklistItem {
  return {
    label,
    checked: false,
    notes: "",
  };
}

function createIncidentEntry(): IncidentEntry {
  return {
    time: "",
    systemArea: "",
    description: "",
    actionsTaken: "",
    workOrderOrVendor: "",
  };
}

function createFridgeTempEntry(date: string): FridgeTempEntry {
  return {
    date,
    time: "",
    tempF: "",
    withinTarget: "Y",
    correctiveAction: "",
    initials: "",
  };
}

function createFireAlarmEntry(): FireAlarmLogEntry {
  return {
    date: "",
    time: "",
    panel: "",
    type: "",
    messageZone: "",
    actionTaken: "",
    cleared: false,
    workOrderNumber: "",
  };
}

export function createDefaultDailyReportPayload(now = new Date()): DailyReportPayload {
  const currentDate = getCurrentDate(now);
  const currentTime = getCurrentTime(now);

  return {
    metadata: {
      date: currentDate,
      start: currentTime,
      end: "",
      inspector: "",
      towers: "both",
      weather: "",
      shift: "",
      supervisorReview: "",
      workOrdersCreated: "",
      signature: "",
    },
    coverageMatrix: COVERAGE_MATRIX_AREAS.map(createCoverageRow),
    commonAreas: COMMON_AREA_ITEMS.map(createChecklistItem),
    temperatures: {
      pumpRoom: "",
      boilerRoom: "",
      atrium: "",
    },
    riskControls: RISK_CONTROL_ITEMS.map(createChecklistItem),
    incidents: [createIncidentEntry()],
    incidentDocumentationReference: "",
    fridgeLogs: [createFridgeTempEntry(currentDate), createFridgeTempEntry(currentDate), createFridgeTempEntry(currentDate)],
    fireAlarmMeta: {
      dateRange: "",
      preparedBy: "",
      supervisorReview: "",
      signature: "",
    },
    fireAlarmEntries: [createFireAlarmEntry(), createFireAlarmEntry(), createFireAlarmEntry()],
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function asAreaStatus(value: unknown): AreaStatus {
  if (value === "O" || value === "D" || value === "NA") return value;
  return "NA";
}

function asTowerSelection(value: unknown): TowerSelection {
  if (value === "north" || value === "south" || value === "both") return value;
  return "both";
}

function asWithinTarget(value: unknown): WithinTarget {
  return value === "N" ? "N" : "Y";
}

function normalizeCoverageRows(input: unknown): CoverageMatrixRow[] {
  const defaults = COVERAGE_MATRIX_AREAS.map(createCoverageRow);
  if (!Array.isArray(input)) return defaults;

  return defaults.map((defaultRow, index) => {
    const candidate = input[index];
    if (!candidate || typeof candidate !== "object") {
      return defaultRow;
    }
    const row = candidate as Record<string, unknown>;
    return {
      area: asString(row.area) || defaultRow.area,
      restrooms: asAreaStatus(row.restrooms),
      fountain: asAreaStatus(row.fountain),
      elecCloset: asAreaStatus(row.elecCloset),
      notes: asString(row.notes),
      initials: asString(row.initials),
    };
  });
}

function normalizeChecklist(input: unknown, labels: string[]): ChecklistItem[] {
  const defaults = labels.map(createChecklistItem);
  if (!Array.isArray(input)) return defaults;

  return defaults.map((defaultItem, index) => {
    const candidate = input[index];
    if (!candidate || typeof candidate !== "object") {
      return defaultItem;
    }
    const item = candidate as Record<string, unknown>;
    return {
      label: asString(item.label) || defaultItem.label,
      checked: asBoolean(item.checked),
      notes: asString(item.notes),
    };
  });
}

function normalizeIncidents(input: unknown): IncidentEntry[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [createIncidentEntry()];
  }

  return input.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return createIncidentEntry();
    }
    const row = candidate as Record<string, unknown>;
    return {
      time: asString(row.time),
      systemArea: asString(row.systemArea),
      description: asString(row.description),
      actionsTaken: asString(row.actionsTaken),
      workOrderOrVendor: asString(row.workOrderOrVendor),
    };
  });
}

function normalizeFridgeLogs(input: unknown, fallbackDate: string): FridgeTempEntry[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [createFridgeTempEntry(fallbackDate), createFridgeTempEntry(fallbackDate), createFridgeTempEntry(fallbackDate)];
  }

  return input.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return createFridgeTempEntry(fallbackDate);
    }
    const row = candidate as Record<string, unknown>;
    return {
      date: asString(row.date) || fallbackDate,
      time: asString(row.time),
      tempF: asString(row.tempF),
      withinTarget: asWithinTarget(row.withinTarget),
      correctiveAction: asString(row.correctiveAction),
      initials: asString(row.initials),
    };
  });
}

function normalizeFireAlarmEntries(input: unknown): FireAlarmLogEntry[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [createFireAlarmEntry(), createFireAlarmEntry(), createFireAlarmEntry()];
  }

  return input.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return createFireAlarmEntry();
    }
    const row = candidate as Record<string, unknown>;
    return {
      date: asString(row.date),
      time: asString(row.time),
      panel: asString(row.panel),
      type: asString(row.type),
      messageZone: asString(row.messageZone),
      actionTaken: asString(row.actionTaken),
      cleared: asBoolean(row.cleared),
      workOrderNumber: asString(row.workOrderNumber),
    };
  });
}

export function normalizeDailyReportPayload(input: unknown): DailyReportPayload {
  const defaults = createDefaultDailyReportPayload();
  if (!input || typeof input !== "object") {
    return defaults;
  }

  const payload = input as Record<string, unknown>;
  const metadata = (payload.metadata as Record<string, unknown> | undefined) || {};
  const normalizedDate = asString(metadata.date) || defaults.metadata.date;

  const temperaturesInput = (payload.temperatures as Record<string, unknown> | undefined) || {};
  const fireAlarmMetaInput = (payload.fireAlarmMeta as Record<string, unknown> | undefined) || {};

  return {
    metadata: {
      date: normalizedDate,
      start: asString(metadata.start),
      end: asString(metadata.end),
      inspector: asString(metadata.inspector),
      towers: asTowerSelection(metadata.towers),
      weather: asString(metadata.weather),
      shift: asString(metadata.shift),
      supervisorReview: asString(metadata.supervisorReview),
      workOrdersCreated: asString(metadata.workOrdersCreated),
      signature: asString(metadata.signature),
    },
    coverageMatrix: normalizeCoverageRows(payload.coverageMatrix),
    commonAreas: normalizeChecklist(payload.commonAreas, COMMON_AREA_ITEMS),
    temperatures: {
      pumpRoom: asString(temperaturesInput.pumpRoom),
      boilerRoom: asString(temperaturesInput.boilerRoom),
      atrium: asString(temperaturesInput.atrium),
    },
    riskControls: normalizeChecklist(payload.riskControls, RISK_CONTROL_ITEMS),
    incidents: normalizeIncidents(payload.incidents),
    incidentDocumentationReference: asString(payload.incidentDocumentationReference),
    fridgeLogs: normalizeFridgeLogs(payload.fridgeLogs, normalizedDate),
    fireAlarmMeta: {
      dateRange: asString(fireAlarmMetaInput.dateRange),
      preparedBy: asString(fireAlarmMetaInput.preparedBy),
      supervisorReview: asString(fireAlarmMetaInput.supervisorReview),
      signature: asString(fireAlarmMetaInput.signature),
    },
    fireAlarmEntries: normalizeFireAlarmEntries(payload.fireAlarmEntries),
  };
}
