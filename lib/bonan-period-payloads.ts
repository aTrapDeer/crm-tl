import {
  getUsCentralDate,
  getWeekEndSaturday,
  getWeekStartSunday,
  getMonthEndDate,
  getMonthKey,
  getMonthStartDate,
} from "./us-central-time";

export type DashboardStatus = "" | "green" | "yellow" | "red";

export interface PriorityWatchRow {
  reference: string;
  level: string;
  opened: string;
  area: string;
  issueSummary: string;
  interimControl: string;
  owner: string;
  dueDate: string;
  status: string;
}

export interface WorkOrderSummaryRow {
  workOrderNumber: string;
  date: string;
  priority: string;
  area: string;
  description: string;
  owner: string;
  status: string;
}

export interface IncidentSummaryRow {
  incidentNumber: string;
  dateTime: string;
  incidentType: string;
  location: string;
  linkedWorkOrder: string;
  immediateAction: string;
  owner: string;
  status: string;
}

export interface AlarmSummaryRow {
  dateTime: string;
  system: string;
  alarmMessage: string;
  cause: string;
  downtime: string;
  actionTaken: string;
  linkedRef: string;
}

export interface ManagementActionRow {
  item: string;
  direction: string;
  owner: string;
  dueDate: string;
  status: string;
}

export interface WeeklyDayRollupRow {
  day: string;
  walkthroughSubmitted: boolean;
  deficienciesFound: string;
  workOrdersCreated: string;
  criticalFindings: boolean;
  dailyReportId: string;
}

export interface CheckupRow {
  item: string;
  planned: string;
  completed: string;
  exceptions: string;
  linkedWorkOrder: string;
  notes: string;
}

export interface SprinklerLogRow {
  date: string;
  runTime: string;
  suctionPsi: string;
  dischargePsi: string;
  controllerNormal: boolean;
  alarmTrouble: boolean;
  notes: string;
}

export interface WeeklyReportPayload {
  metadata: {
    weekStart: string;
    weekEnd: string;
    preparedBy: string;
    title: string;
    propertyManagerReview: string;
    constructionMgmtReview: string;
    datePrepared: string;
  };
  collectiveSummary: {
    overallStatus: DashboardStatus;
    lifeSafetyOpen: string;
    highRiskOpen: string;
    dailyWalkthroughCompletion: string;
    criticalCheckupsCompletion: string;
    incidentReportsFiled: string;
    alarmEvents: string;
    notes: string;
  };
  kpiSummary: {
    openStart: string;
    openedThisWeek: string;
    closedThisWeek: string;
    openEnd: string;
    level1Open: string;
    level2Open: string;
    level3Open: string;
    level4Open: string;
  };
  priorityWatchList: PriorityWatchRow[];
  workOrdersCreated: WorkOrderSummaryRow[];
  workOrdersClosed: WorkOrderSummaryRow[];
  openCarryForward: WorkOrderSummaryRow[];
  incidents: IncidentSummaryRow[];
  alarmEventsLog: AlarmSummaryRow[];
  dailyRollup: WeeklyDayRollupRow[];
  weeklyCheckups: CheckupRow[];
  sprinklerLogs: SprinklerLogRow[];
  managementActions: ManagementActionRow[];
  managementNotes: string;
}

export interface MonthlyWeeklyRollupRow {
  weekLabel: string;
  weeklyReportId: string;
  dailyReportsLinked: string;
  workOrdersOpened: string;
  workOrdersClosed: string;
  incidents: string;
  checkupsCompleted: string;
  walkthroughCompletion: string;
}

export interface MonthlyWalkthroughWeekRow {
  weekLabel: string;
  walkthroughsDue: string;
  walkthroughsCompleted: string;
  completionPercent: string;
  deficienciesFound: string;
  workOrdersCreated: string;
}

export interface MonthlyExceptionRow {
  date: string;
  areaOrSystem: string;
  exception: string;
  riskLevel: string;
  actionOrWorkOrder: string;
  owner: string;
  dueDate: string;
}

export interface MonthlyFireExtinguisherRow {
  extinguisherIdLocation: string;
  gauge: string;
  pinSeal: string;
  accessible: string;
  condition: string;
  initials: string;
  notesWorkOrder: string;
}

export interface MonthlyEmergencyLightingRow {
  date: string;
  areaDevice: string;
  duration: string;
  passFail: string;
  correctiveActionWorkOrder: string;
  initials: string;
}

export interface MonthlyDeficiencyRegisterRow {
  workOrderNumber: string;
  level: string;
  opened: string;
  areaLocation: string;
  descriptionNextAction: string;
  target: string;
  status: string;
}

export interface MonthlyElevatorComplianceRow {
  elevator: string;
  permit: string;
  rideDoors: string;
  alarm: string;
  phone: string;
  cab: string;
  notesWorkOrder: string;
}

export interface MonthlyReportPayload {
  metadata: {
    monthStart: string;
    monthEnd: string;
    monthKey: string;
    preparedBy: string;
    propertyManagerReview: string;
    constructionMgmtReview: string;
    datePrepared: string;
  };
  collectiveSummary: {
    overallStatus: DashboardStatus;
    openWorkOrdersMonthEnd: string;
    level1OpenMonthEnd: string;
    level2OpenMonthEnd: string;
    incidentReportsFiled: string;
    alarmEvents: string;
    dailyWalkthroughCompletion: string;
    monthlyCheckupCompletion: string;
    notes: string;
  };
  kpiSummary: {
    openStart: string;
    openedThisMonth: string;
    closedThisMonth: string;
    openEnd: string;
    level1Open: string;
    level2Open: string;
    level3Open: string;
    level4Open: string;
  };
  weeklyRollup: MonthlyWeeklyRollupRow[];
  riskWatchList: PriorityWatchRow[];
  workOrdersOpened: WorkOrderSummaryRow[];
  workOrdersClosed: WorkOrderSummaryRow[];
  agingOpenWorkOrders: WorkOrderSummaryRow[];
  incidents: IncidentSummaryRow[];
  alarmEventsLog: AlarmSummaryRow[];
  dailyWalkthroughByWeek: MonthlyWalkthroughWeekRow[];
  criticalCheckups: CheckupRow[];
  monthlyExceptions: MonthlyExceptionRow[];
  fireExtinguisherLog: {
    monthYear: string;
    inspector: string;
    supervisorReview: string;
    signature: string;
    rows: MonthlyFireExtinguisherRow[];
  };
  emergencyLightingLog: {
    monthYear: string;
    inspector: string;
    supervisorReview: string;
    signature: string;
    rows: MonthlyEmergencyLightingRow[];
  };
  deficiencyRegister: {
    monthYear: string;
    preparedBy: string;
    supervisorReview: string;
    signature: string;
    totalOpenStart: string;
    newThisMonth: string;
    closedThisMonth: string;
    openEnd: string;
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    rows: MonthlyDeficiencyRegisterRow[];
    managementNotes: string;
    ownerExecutiveReview: string;
    ownerExecutiveDate: string;
  };
  elevatorComplianceLog: {
    monthYear: string;
    inspector: string;
    vendorServiceDate: string;
    workOrderNumber: string;
    rows: MonthlyElevatorComplianceRow[];
    northCar1Expiration: string;
    northCar2Expiration: string;
    southCar1Expiration: string;
    southCar2Expiration: string;
    notesCorrectiveActions: string;
  };
  closeoutCertification: {
    month: string;
    year: string;
    preparedBy: string;
    title: string;
    reviewedBy: string;
    datePrepared: string;
    dateReviewed: string;
    binderTab: string;
    certifiedBySignature: string;
    certifiedDate: string;
    reviewedAcceptedSignature: string;
    reviewedAcceptedDate: string;
  };
  summaryMetrics: {
    totalWorkOrdersOpened: string;
    totalWorkOrdersClosed: string;
    workOrdersRemainingOpen: string;
    level1Count: string;
    level2Count: string;
    level3Count: string;
    level4Count: string;
    notableEvents: string;
  };
  closeoutChecklist: {
    dailyWalkthroughLogsCompleted: boolean;
    dailyCriticalChecksCompleted: boolean;
    weeklySprinklerLogsCompleted: boolean;
    incidentReportsFiled: boolean;
    deficiencyRegisterUpdated: boolean;
    openWorkOrdersReviewed: boolean;
  };
  inspectionNotes: {
    fireExtinguisher: string;
    emergencyLighting: string;
    elevator: string;
    deficiencyRegister: string;
  };
  managementActions: ManagementActionRow[];
  managementNotes: string;
}

const WEEKLY_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHECKUP_ITEMS = [
  "Sprinkler Pump Room Weekly Test",
  "Fire Alarm Panel Trouble Review",
  "Elevator Functional Spot Checks",
  "Egress/Stairwell Condition Check",
  "Mechanical/Boiler Room Condition Check",
];
const MONTHLY_WEEK_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5 (if applicable)"];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asDashboardStatus(value: unknown): DashboardStatus {
  return value === "green" || value === "yellow" || value === "red" || value === ""
    ? value
    : "";
}

function makePriorityWatchRow(): PriorityWatchRow {
  return {
    reference: "",
    level: "",
    opened: "",
    area: "",
    issueSummary: "",
    interimControl: "",
    owner: "",
    dueDate: "",
    status: "",
  };
}

function makeWorkOrderSummaryRow(): WorkOrderSummaryRow {
  return {
    workOrderNumber: "",
    date: "",
    priority: "",
    area: "",
    description: "",
    owner: "",
    status: "",
  };
}

function makeIncidentSummaryRow(): IncidentSummaryRow {
  return {
    incidentNumber: "",
    dateTime: "",
    incidentType: "",
    location: "",
    linkedWorkOrder: "",
    immediateAction: "",
    owner: "",
    status: "",
  };
}

function makeAlarmSummaryRow(): AlarmSummaryRow {
  return {
    dateTime: "",
    system: "",
    alarmMessage: "",
    cause: "",
    downtime: "",
    actionTaken: "",
    linkedRef: "",
  };
}

function makeManagementActionRow(): ManagementActionRow {
  return {
    item: "",
    direction: "",
    owner: "",
    dueDate: "",
    status: "",
  };
}

function makeWeeklyRollupRow(day: string): WeeklyDayRollupRow {
  return {
    day,
    walkthroughSubmitted: false,
    deficienciesFound: "",
    workOrdersCreated: "",
    criticalFindings: false,
    dailyReportId: "",
  };
}

function makeCheckupRow(item: string): CheckupRow {
  return {
    item,
    planned: "",
    completed: "",
    exceptions: "",
    linkedWorkOrder: "",
    notes: "",
  };
}

function makeSprinklerLogRow(): SprinklerLogRow {
  return {
    date: "",
    runTime: "",
    suctionPsi: "",
    dischargePsi: "",
    controllerNormal: true,
    alarmTrouble: false,
    notes: "",
  };
}

function makeMonthlyFireExtinguisherRow(): MonthlyFireExtinguisherRow {
  return {
    extinguisherIdLocation: "",
    gauge: "",
    pinSeal: "",
    accessible: "",
    condition: "",
    initials: "",
    notesWorkOrder: "",
  };
}

function makeMonthlyEmergencyLightingRow(): MonthlyEmergencyLightingRow {
  return {
    date: "",
    areaDevice: "",
    duration: "",
    passFail: "",
    correctiveActionWorkOrder: "",
    initials: "",
  };
}

function makeMonthlyDeficiencyRegisterRow(): MonthlyDeficiencyRegisterRow {
  return {
    workOrderNumber: "",
    level: "",
    opened: "",
    areaLocation: "",
    descriptionNextAction: "",
    target: "",
    status: "",
  };
}

function makeMonthlyElevatorComplianceRow(elevator: string): MonthlyElevatorComplianceRow {
  return {
    elevator,
    permit: "",
    rideDoors: "",
    alarm: "",
    phone: "",
    cab: "",
    notesWorkOrder: "",
  };
}

function normalizePriorityWatchRow(row: Record<string, unknown>): PriorityWatchRow {
  return {
    reference: asString(row.reference),
    level: asString(row.level),
    opened: asString(row.opened),
    area: asString(row.area),
    issueSummary: asString(row.issueSummary),
    interimControl: asString(row.interimControl),
    owner: asString(row.owner),
    dueDate: asString(row.dueDate),
    status: asString(row.status),
  };
}

function normalizeWorkOrderSummaryRow(row: Record<string, unknown>): WorkOrderSummaryRow {
  return {
    workOrderNumber: asString(row.workOrderNumber),
    date: asString(row.date),
    priority: asString(row.priority),
    area: asString(row.area),
    description: asString(row.description),
    owner: asString(row.owner),
    status: asString(row.status),
  };
}

function normalizeIncidentSummaryRow(row: Record<string, unknown>): IncidentSummaryRow {
  return {
    incidentNumber: asString(row.incidentNumber),
    dateTime: asString(row.dateTime),
    incidentType: asString(row.incidentType),
    location: asString(row.location),
    linkedWorkOrder: asString(row.linkedWorkOrder),
    immediateAction: asString(row.immediateAction),
    owner: asString(row.owner),
    status: asString(row.status),
  };
}

function normalizeAlarmSummaryRow(row: Record<string, unknown>): AlarmSummaryRow {
  return {
    dateTime: asString(row.dateTime),
    system: asString(row.system),
    alarmMessage: asString(row.alarmMessage),
    cause: asString(row.cause),
    downtime: asString(row.downtime),
    actionTaken: asString(row.actionTaken),
    linkedRef: asString(row.linkedRef),
  };
}

function normalizeManagementActionRow(row: Record<string, unknown>): ManagementActionRow {
  return {
    item: asString(row.item),
    direction: asString(row.direction),
    owner: asString(row.owner),
    dueDate: asString(row.dueDate),
    status: asString(row.status),
  };
}

function normalizeRows<T>(
  input: unknown,
  defaults: T[],
  mapper: (row: Record<string, unknown>, defaultRow: T) => T
): T[] {
  if (!Array.isArray(input) || input.length === 0) return defaults;
  return input.map((value, index) => {
    const fallback = defaults[index] ?? defaults[defaults.length - 1];
    if (!value || typeof value !== "object") return fallback;
    return mapper(value as Record<string, unknown>, fallback);
  });
}

export function createDefaultWeeklyReportPayload(baseDate = getUsCentralDate()): WeeklyReportPayload {
  const weekStart = getWeekStartSunday(baseDate);
  return {
    metadata: {
      weekStart,
      weekEnd: getWeekEndSaturday(baseDate),
      preparedBy: "",
      title: "",
      propertyManagerReview: "",
      constructionMgmtReview: "",
      datePrepared: getUsCentralDate(),
    },
    collectiveSummary: {
      overallStatus: "",
      lifeSafetyOpen: "",
      highRiskOpen: "",
      dailyWalkthroughCompletion: "",
      criticalCheckupsCompletion: "",
      incidentReportsFiled: "",
      alarmEvents: "",
      notes: "",
    },
    kpiSummary: {
      openStart: "",
      openedThisWeek: "",
      closedThisWeek: "",
      openEnd: "",
      level1Open: "",
      level2Open: "",
      level3Open: "",
      level4Open: "",
    },
    priorityWatchList: Array.from({ length: 6 }, makePriorityWatchRow),
    workOrdersCreated: Array.from({ length: 8 }, makeWorkOrderSummaryRow),
    workOrdersClosed: Array.from({ length: 6 }, makeWorkOrderSummaryRow),
    openCarryForward: Array.from({ length: 6 }, makeWorkOrderSummaryRow),
    incidents: Array.from({ length: 5 }, makeIncidentSummaryRow),
    alarmEventsLog: Array.from({ length: 5 }, makeAlarmSummaryRow),
    dailyRollup: WEEKLY_DAY_NAMES.map(makeWeeklyRollupRow),
    weeklyCheckups: CHECKUP_ITEMS.map(makeCheckupRow),
    sprinklerLogs: Array.from({ length: 7 }, makeSprinklerLogRow),
    managementActions: Array.from({ length: 4 }, makeManagementActionRow),
    managementNotes: "",
  };
}

export function normalizeWeeklyReportPayload(input: unknown, fallbackDate = getUsCentralDate()): WeeklyReportPayload {
  const defaults = createDefaultWeeklyReportPayload(fallbackDate);
  if (!input || typeof input !== "object") return defaults;

  const payload = input as Record<string, unknown>;
  const metadata = (payload.metadata as Record<string, unknown> | undefined) || {};
  const weekStart = getWeekStartSunday(asString(metadata.weekStart) || defaults.metadata.weekStart);

  return {
    ...defaults,
    metadata: {
      weekStart,
      weekEnd: getWeekEndSaturday(weekStart),
      preparedBy: asString(metadata.preparedBy),
      title: asString(metadata.title),
      propertyManagerReview: asString(metadata.propertyManagerReview),
      constructionMgmtReview: asString(metadata.constructionMgmtReview),
      datePrepared: asString(metadata.datePrepared) || defaults.metadata.datePrepared,
    },
    collectiveSummary: {
      overallStatus: asDashboardStatus((payload.collectiveSummary as Record<string, unknown> | undefined)?.overallStatus),
      lifeSafetyOpen: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.lifeSafetyOpen),
      highRiskOpen: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.highRiskOpen),
      dailyWalkthroughCompletion: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.dailyWalkthroughCompletion),
      criticalCheckupsCompletion: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.criticalCheckupsCompletion),
      incidentReportsFiled: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.incidentReportsFiled),
      alarmEvents: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.alarmEvents),
      notes: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.notes),
    },
    kpiSummary: {
      openStart: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.openStart),
      openedThisWeek: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.openedThisWeek),
      closedThisWeek: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.closedThisWeek),
      openEnd: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.openEnd),
      level1Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level1Open),
      level2Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level2Open),
      level3Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level3Open),
      level4Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level4Open),
    },
    priorityWatchList: normalizeRows(payload.priorityWatchList, defaults.priorityWatchList, (row) => normalizePriorityWatchRow(row)),
    workOrdersCreated: normalizeRows(payload.workOrdersCreated, defaults.workOrdersCreated, (row) => normalizeWorkOrderSummaryRow(row)),
    workOrdersClosed: normalizeRows(payload.workOrdersClosed, defaults.workOrdersClosed, (row) => normalizeWorkOrderSummaryRow(row)),
    openCarryForward: normalizeRows(payload.openCarryForward, defaults.openCarryForward, (row) => normalizeWorkOrderSummaryRow(row)),
    incidents: normalizeRows(payload.incidents, defaults.incidents, (row) => normalizeIncidentSummaryRow(row)),
    alarmEventsLog: normalizeRows(payload.alarmEventsLog, defaults.alarmEventsLog, (row) => normalizeAlarmSummaryRow(row)),
    dailyRollup: normalizeRows(payload.dailyRollup, defaults.dailyRollup, (row, fallback) => ({
      day: asString(row.day) || fallback.day,
      walkthroughSubmitted: asBoolean(row.walkthroughSubmitted),
      deficienciesFound: asString(row.deficienciesFound),
      workOrdersCreated: asString(row.workOrdersCreated),
      criticalFindings: asBoolean(row.criticalFindings),
      dailyReportId: asString(row.dailyReportId),
    })),
    weeklyCheckups: normalizeRows(payload.weeklyCheckups, defaults.weeklyCheckups, (row, fallback) => ({
      item: asString(row.item) || fallback.item,
      planned: asString(row.planned),
      completed: asString(row.completed),
      exceptions: asString(row.exceptions),
      linkedWorkOrder: asString(row.linkedWorkOrder),
      notes: asString(row.notes),
    })),
    sprinklerLogs: normalizeRows(payload.sprinklerLogs, defaults.sprinklerLogs, (row) => ({
      date: asString(row.date),
      runTime: asString(row.runTime),
      suctionPsi: asString(row.suctionPsi),
      dischargePsi: asString(row.dischargePsi),
      controllerNormal: asBoolean(row.controllerNormal),
      alarmTrouble: asBoolean(row.alarmTrouble),
      notes: asString(row.notes),
    })),
    managementActions: normalizeRows(payload.managementActions, defaults.managementActions, (row) => normalizeManagementActionRow(row)),
    managementNotes: asString(payload.managementNotes),
  };
}

export function createDefaultMonthlyReportPayload(baseDate = getUsCentralDate()): MonthlyReportPayload {
  const monthKey = getMonthKey(baseDate);
  const [year, month] = monthKey.split("-");
  return {
    metadata: {
      monthStart: getMonthStartDate(baseDate),
      monthEnd: getMonthEndDate(baseDate),
      monthKey,
      preparedBy: "",
      propertyManagerReview: "",
      constructionMgmtReview: "",
      datePrepared: getUsCentralDate(),
    },
    collectiveSummary: {
      overallStatus: "",
      openWorkOrdersMonthEnd: "",
      level1OpenMonthEnd: "",
      level2OpenMonthEnd: "",
      incidentReportsFiled: "",
      alarmEvents: "",
      dailyWalkthroughCompletion: "",
      monthlyCheckupCompletion: "",
      notes: "",
    },
    kpiSummary: {
      openStart: "",
      openedThisMonth: "",
      closedThisMonth: "",
      openEnd: "",
      level1Open: "",
      level2Open: "",
      level3Open: "",
      level4Open: "",
    },
    weeklyRollup: MONTHLY_WEEK_LABELS.map((weekLabel) => ({
      weekLabel,
      weeklyReportId: "",
      dailyReportsLinked: "",
      workOrdersOpened: "",
      workOrdersClosed: "",
      incidents: "",
      checkupsCompleted: "",
      walkthroughCompletion: "",
    })),
    riskWatchList: Array.from({ length: 6 }, makePriorityWatchRow),
    workOrdersOpened: Array.from({ length: 10 }, makeWorkOrderSummaryRow),
    workOrdersClosed: Array.from({ length: 8 }, makeWorkOrderSummaryRow),
    agingOpenWorkOrders: Array.from({ length: 6 }, makeWorkOrderSummaryRow),
    incidents: Array.from({ length: 8 }, makeIncidentSummaryRow),
    alarmEventsLog: Array.from({ length: 6 }, makeAlarmSummaryRow),
    dailyWalkthroughByWeek: MONTHLY_WEEK_LABELS.map((weekLabel) => ({
      weekLabel,
      walkthroughsDue: "",
      walkthroughsCompleted: "",
      completionPercent: "",
      deficienciesFound: "",
      workOrdersCreated: "",
    })),
    criticalCheckups: CHECKUP_ITEMS.map(makeCheckupRow),
    monthlyExceptions: Array.from({ length: 4 }, () => ({
      date: "",
      areaOrSystem: "",
      exception: "",
      riskLevel: "",
      actionOrWorkOrder: "",
      owner: "",
      dueDate: "",
    })),
    fireExtinguisherLog: {
      monthYear: monthKey,
      inspector: "",
      supervisorReview: "",
      signature: "",
      rows: Array.from({ length: 18 }, makeMonthlyFireExtinguisherRow),
    },
    emergencyLightingLog: {
      monthYear: monthKey,
      inspector: "",
      supervisorReview: "",
      signature: "",
      rows: Array.from({ length: 16 }, makeMonthlyEmergencyLightingRow),
    },
    deficiencyRegister: {
      monthYear: monthKey,
      preparedBy: "",
      supervisorReview: "",
      signature: "",
      totalOpenStart: "",
      newThisMonth: "",
      closedThisMonth: "",
      openEnd: "",
      level1: "",
      level2: "",
      level3: "",
      level4: "",
      rows: Array.from({ length: 12 }, makeMonthlyDeficiencyRegisterRow),
      managementNotes: "",
      ownerExecutiveReview: "",
      ownerExecutiveDate: "",
    },
    elevatorComplianceLog: {
      monthYear: monthKey,
      inspector: "",
      vendorServiceDate: "",
      workOrderNumber: "",
      rows: [
        makeMonthlyElevatorComplianceRow("North Car 1"),
        makeMonthlyElevatorComplianceRow("North Car 2"),
        makeMonthlyElevatorComplianceRow("South Car 1"),
        makeMonthlyElevatorComplianceRow("South Car 2"),
      ],
      northCar1Expiration: "",
      northCar2Expiration: "",
      southCar1Expiration: "",
      southCar2Expiration: "",
      notesCorrectiveActions: "",
    },
    closeoutCertification: {
      month,
      year,
      preparedBy: "",
      title: "",
      reviewedBy: "",
      datePrepared: "",
      dateReviewed: "",
      binderTab: "",
      certifiedBySignature: "",
      certifiedDate: "",
      reviewedAcceptedSignature: "",
      reviewedAcceptedDate: "",
    },
    summaryMetrics: {
      totalWorkOrdersOpened: "",
      totalWorkOrdersClosed: "",
      workOrdersRemainingOpen: "",
      level1Count: "",
      level2Count: "",
      level3Count: "",
      level4Count: "",
      notableEvents: "",
    },
    closeoutChecklist: {
      dailyWalkthroughLogsCompleted: false,
      dailyCriticalChecksCompleted: false,
      weeklySprinklerLogsCompleted: false,
      incidentReportsFiled: false,
      deficiencyRegisterUpdated: false,
      openWorkOrdersReviewed: false,
    },
    inspectionNotes: {
      fireExtinguisher: "",
      emergencyLighting: "",
      elevator: "",
      deficiencyRegister: "",
    },
    managementActions: Array.from({ length: 4 }, makeManagementActionRow),
    managementNotes: "",
  };
}

export function normalizeMonthlyReportPayload(input: unknown, fallbackDate = getUsCentralDate()): MonthlyReportPayload {
  const defaults = createDefaultMonthlyReportPayload(fallbackDate);
  if (!input || typeof input !== "object") return defaults;

  const payload = input as Record<string, unknown>;
  const metadata = (payload.metadata as Record<string, unknown> | undefined) || {};
  const monthStart = getMonthStartDate(asString(metadata.monthStart) || defaults.metadata.monthStart);

  return {
    ...defaults,
    metadata: {
      monthStart,
      monthEnd: getMonthEndDate(monthStart),
      monthKey: getMonthKey(monthStart),
      preparedBy: asString(metadata.preparedBy),
      propertyManagerReview: asString(metadata.propertyManagerReview),
      constructionMgmtReview: asString(metadata.constructionMgmtReview),
      datePrepared: asString(metadata.datePrepared) || defaults.metadata.datePrepared,
    },
    collectiveSummary: {
      overallStatus: asDashboardStatus((payload.collectiveSummary as Record<string, unknown> | undefined)?.overallStatus),
      openWorkOrdersMonthEnd: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.openWorkOrdersMonthEnd),
      level1OpenMonthEnd: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.level1OpenMonthEnd),
      level2OpenMonthEnd: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.level2OpenMonthEnd),
      incidentReportsFiled: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.incidentReportsFiled),
      alarmEvents: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.alarmEvents),
      dailyWalkthroughCompletion: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.dailyWalkthroughCompletion),
      monthlyCheckupCompletion: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.monthlyCheckupCompletion),
      notes: asString((payload.collectiveSummary as Record<string, unknown> | undefined)?.notes),
    },
    kpiSummary: {
      openStart: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.openStart),
      openedThisMonth: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.openedThisMonth),
      closedThisMonth: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.closedThisMonth),
      openEnd: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.openEnd),
      level1Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level1Open),
      level2Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level2Open),
      level3Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level3Open),
      level4Open: asString((payload.kpiSummary as Record<string, unknown> | undefined)?.level4Open),
    },
    weeklyRollup: normalizeRows(payload.weeklyRollup, defaults.weeklyRollup, (row, fallback) => ({
      weekLabel: asString(row.weekLabel) || fallback.weekLabel,
      weeklyReportId: asString(row.weeklyReportId),
      dailyReportsLinked: asString(row.dailyReportsLinked),
      workOrdersOpened: asString(row.workOrdersOpened),
      workOrdersClosed: asString(row.workOrdersClosed),
      incidents: asString(row.incidents),
      checkupsCompleted: asString(row.checkupsCompleted),
      walkthroughCompletion: asString(row.walkthroughCompletion),
    })),
    riskWatchList: normalizeRows(payload.riskWatchList, defaults.riskWatchList, (row) => normalizePriorityWatchRow(row)),
    workOrdersOpened: normalizeRows(payload.workOrdersOpened, defaults.workOrdersOpened, (row) => normalizeWorkOrderSummaryRow(row)),
    workOrdersClosed: normalizeRows(payload.workOrdersClosed, defaults.workOrdersClosed, (row) => normalizeWorkOrderSummaryRow(row)),
    agingOpenWorkOrders: normalizeRows(payload.agingOpenWorkOrders, defaults.agingOpenWorkOrders, (row) => normalizeWorkOrderSummaryRow(row)),
    incidents: normalizeRows(payload.incidents, defaults.incidents, (row) => normalizeIncidentSummaryRow(row)),
    alarmEventsLog: normalizeRows(payload.alarmEventsLog, defaults.alarmEventsLog, (row) => normalizeAlarmSummaryRow(row)),
    dailyWalkthroughByWeek: normalizeRows(payload.dailyWalkthroughByWeek, defaults.dailyWalkthroughByWeek, (row, fallback) => ({
      weekLabel: asString(row.weekLabel) || fallback.weekLabel,
      walkthroughsDue: asString(row.walkthroughsDue),
      walkthroughsCompleted: asString(row.walkthroughsCompleted),
      completionPercent: asString(row.completionPercent),
      deficienciesFound: asString(row.deficienciesFound),
      workOrdersCreated: asString(row.workOrdersCreated),
    })),
    criticalCheckups: normalizeRows(payload.criticalCheckups, defaults.criticalCheckups, (row, fallback) => ({
      item: asString(row.item) || fallback.item,
      planned: asString(row.planned),
      completed: asString(row.completed),
      exceptions: asString(row.exceptions),
      linkedWorkOrder: asString(row.linkedWorkOrder),
      notes: asString(row.notes),
    })),
    monthlyExceptions: normalizeRows(payload.monthlyExceptions, defaults.monthlyExceptions, (row) => ({
      date: asString(row.date),
      areaOrSystem: asString(row.areaOrSystem),
      exception: asString(row.exception),
      riskLevel: asString(row.riskLevel),
      actionOrWorkOrder: asString(row.actionOrWorkOrder),
      owner: asString(row.owner),
      dueDate: asString(row.dueDate),
    })),
    fireExtinguisherLog: {
      monthYear: asString((payload.fireExtinguisherLog as Record<string, unknown> | undefined)?.monthYear) || defaults.fireExtinguisherLog.monthYear,
      inspector: asString((payload.fireExtinguisherLog as Record<string, unknown> | undefined)?.inspector),
      supervisorReview: asString((payload.fireExtinguisherLog as Record<string, unknown> | undefined)?.supervisorReview),
      signature: asString((payload.fireExtinguisherLog as Record<string, unknown> | undefined)?.signature),
      rows: normalizeRows(
        (payload.fireExtinguisherLog as Record<string, unknown> | undefined)?.rows,
        defaults.fireExtinguisherLog.rows,
        (row) => ({
          extinguisherIdLocation: asString(row.extinguisherIdLocation),
          gauge: asString(row.gauge),
          pinSeal: asString(row.pinSeal),
          accessible: asString(row.accessible),
          condition: asString(row.condition),
          initials: asString(row.initials),
          notesWorkOrder: asString(row.notesWorkOrder),
        })
      ),
    },
    emergencyLightingLog: {
      monthYear: asString((payload.emergencyLightingLog as Record<string, unknown> | undefined)?.monthYear) || defaults.emergencyLightingLog.monthYear,
      inspector: asString((payload.emergencyLightingLog as Record<string, unknown> | undefined)?.inspector),
      supervisorReview: asString((payload.emergencyLightingLog as Record<string, unknown> | undefined)?.supervisorReview),
      signature: asString((payload.emergencyLightingLog as Record<string, unknown> | undefined)?.signature),
      rows: normalizeRows(
        (payload.emergencyLightingLog as Record<string, unknown> | undefined)?.rows,
        defaults.emergencyLightingLog.rows,
        (row) => ({
          date: asString(row.date),
          areaDevice: asString(row.areaDevice),
          duration: asString(row.duration),
          passFail: asString(row.passFail),
          correctiveActionWorkOrder: asString(row.correctiveActionWorkOrder),
          initials: asString(row.initials),
        })
      ),
    },
    deficiencyRegister: {
      monthYear: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.monthYear) || defaults.deficiencyRegister.monthYear,
      preparedBy: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.preparedBy),
      supervisorReview: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.supervisorReview),
      signature: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.signature),
      totalOpenStart: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.totalOpenStart),
      newThisMonth: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.newThisMonth),
      closedThisMonth: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.closedThisMonth),
      openEnd: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.openEnd),
      level1: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.level1),
      level2: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.level2),
      level3: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.level3),
      level4: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.level4),
      rows: normalizeRows(
        (payload.deficiencyRegister as Record<string, unknown> | undefined)?.rows,
        defaults.deficiencyRegister.rows,
        (row) => ({
          workOrderNumber: asString(row.workOrderNumber),
          level: asString(row.level),
          opened: asString(row.opened),
          areaLocation: asString(row.areaLocation),
          descriptionNextAction: asString(row.descriptionNextAction),
          target: asString(row.target),
          status: asString(row.status),
        })
      ),
      managementNotes: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.managementNotes),
      ownerExecutiveReview: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.ownerExecutiveReview),
      ownerExecutiveDate: asString((payload.deficiencyRegister as Record<string, unknown> | undefined)?.ownerExecutiveDate),
    },
    elevatorComplianceLog: {
      monthYear: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.monthYear) || defaults.elevatorComplianceLog.monthYear,
      inspector: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.inspector),
      vendorServiceDate: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.vendorServiceDate),
      workOrderNumber: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.workOrderNumber),
      rows: normalizeRows(
        (payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.rows,
        defaults.elevatorComplianceLog.rows,
        (row, fallback) => ({
          elevator: asString(row.elevator) || fallback.elevator,
          permit: asString(row.permit),
          rideDoors: asString(row.rideDoors),
          alarm: asString(row.alarm),
          phone: asString(row.phone),
          cab: asString(row.cab),
          notesWorkOrder: asString(row.notesWorkOrder),
        })
      ),
      northCar1Expiration: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.northCar1Expiration),
      northCar2Expiration: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.northCar2Expiration),
      southCar1Expiration: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.southCar1Expiration),
      southCar2Expiration: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.southCar2Expiration),
      notesCorrectiveActions: asString((payload.elevatorComplianceLog as Record<string, unknown> | undefined)?.notesCorrectiveActions),
    },
    closeoutCertification: {
      month: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.month) || defaults.closeoutCertification.month,
      year: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.year) || defaults.closeoutCertification.year,
      preparedBy: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.preparedBy),
      title: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.title),
      reviewedBy: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.reviewedBy),
      datePrepared: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.datePrepared),
      dateReviewed: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.dateReviewed),
      binderTab: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.binderTab),
      certifiedBySignature: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.certifiedBySignature),
      certifiedDate: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.certifiedDate),
      reviewedAcceptedSignature: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.reviewedAcceptedSignature),
      reviewedAcceptedDate: asString((payload.closeoutCertification as Record<string, unknown> | undefined)?.reviewedAcceptedDate),
    },
    summaryMetrics: {
      totalWorkOrdersOpened: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.totalWorkOrdersOpened),
      totalWorkOrdersClosed: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.totalWorkOrdersClosed),
      workOrdersRemainingOpen: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.workOrdersRemainingOpen),
      level1Count: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.level1Count),
      level2Count: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.level2Count),
      level3Count: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.level3Count),
      level4Count: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.level4Count),
      notableEvents: asString((payload.summaryMetrics as Record<string, unknown> | undefined)?.notableEvents),
    },
    closeoutChecklist: {
      dailyWalkthroughLogsCompleted: asBoolean((payload.closeoutChecklist as Record<string, unknown> | undefined)?.dailyWalkthroughLogsCompleted),
      dailyCriticalChecksCompleted: asBoolean((payload.closeoutChecklist as Record<string, unknown> | undefined)?.dailyCriticalChecksCompleted),
      weeklySprinklerLogsCompleted: asBoolean((payload.closeoutChecklist as Record<string, unknown> | undefined)?.weeklySprinklerLogsCompleted),
      incidentReportsFiled: asBoolean((payload.closeoutChecklist as Record<string, unknown> | undefined)?.incidentReportsFiled),
      deficiencyRegisterUpdated: asBoolean((payload.closeoutChecklist as Record<string, unknown> | undefined)?.deficiencyRegisterUpdated),
      openWorkOrdersReviewed: asBoolean((payload.closeoutChecklist as Record<string, unknown> | undefined)?.openWorkOrdersReviewed),
    },
    inspectionNotes: {
      fireExtinguisher: asString((payload.inspectionNotes as Record<string, unknown> | undefined)?.fireExtinguisher),
      emergencyLighting: asString((payload.inspectionNotes as Record<string, unknown> | undefined)?.emergencyLighting),
      elevator: asString((payload.inspectionNotes as Record<string, unknown> | undefined)?.elevator),
      deficiencyRegister: asString((payload.inspectionNotes as Record<string, unknown> | undefined)?.deficiencyRegister),
    },
    managementActions: normalizeRows(payload.managementActions, defaults.managementActions, (row) => normalizeManagementActionRow(row)),
    managementNotes: asString(payload.managementNotes),
  };
}
