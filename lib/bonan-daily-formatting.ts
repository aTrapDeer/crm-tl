const TEMPERATURE_PATHS = new Set([
  "temperatures.pumpRoom",
  "temperatures.boilerRoom",
  "temperatures.atrium",
  "criticalWaterStructuralChecks.boilerRoom.boiler1.sh1Temp",
  "criticalWaterStructuralChecks.boilerRoom.boiler1.sh2Temp",
  "criticalWaterStructuralChecks.boilerRoom.boiler1.sh3Temp",
  "criticalWaterStructuralChecks.boilerRoom.boiler1.dhwTemp",
  "criticalWaterStructuralChecks.boilerRoom.boiler2.sh1Temp",
  "criticalWaterStructuralChecks.boilerRoom.boiler2.sh2Temp",
  "criticalWaterStructuralChecks.boilerRoom.boiler2.sh3Temp",
  "criticalWaterStructuralChecks.boilerRoom.boiler2.dhwTemp",
]);

const PSI_PATHS = new Set([
  "criticalWaterStructuralChecks.boilerRoom.gaugeLeftSuctionPsi",
  "criticalWaterStructuralChecks.boilerRoom.gaugeRightDischargePsi",
  "criticalWaterStructuralChecks.boilerRoom.pump1SuctionPsi",
  "criticalWaterStructuralChecks.boilerRoom.pump1DischargePsi",
  "criticalWaterStructuralChecks.boilerRoom.pump2SuctionPsi",
  "criticalWaterStructuralChecks.boilerRoom.pump2DischargePsi",
  "criticalWaterStructuralChecks.boilerRoom.airCompressorPsi",
  "criticalWaterStructuralChecks.pumpRoom.pressureReading1",
  "criticalWaterStructuralChecks.pumpRoom.pressureReading2",
]);

const LABEL_OVERRIDES: Record<string, string> = {
  kpiSummary: "Performance Summary",
  "criticalWaterStructuralChecks.boilerRoom.gaugeLeftSuctionPsi": "Gauge Left Suction",
  "criticalWaterStructuralChecks.boilerRoom.gaugeRightDischargePsi": "Gauge Right Suction",
  "criticalWaterStructuralChecks.boilerRoom.pump1SuctionPsi": "Pump-1 Suction (PSI)",
  "criticalWaterStructuralChecks.boilerRoom.pump1DischargePsi": "Pump-1 Discharge (PSI)",
  "criticalWaterStructuralChecks.boilerRoom.pump2SuctionPsi": "Pump-2 Suction (PSI)",
  "criticalWaterStructuralChecks.boilerRoom.pump2DischargePsi": "Pump-2 Discharge (PSI)",
  "criticalWaterStructuralChecks.boilerRoom.airCompressorPsi": "Air Compressor",
};

const COVERAGE_MATRIX_STATUS_KEYS = new Set([
  "restroomsMale",
  "restroomsFemale",
  "fountain",
  "elecCloset",
]);

const COVERAGE_STATUS_LABELS: Record<string, string> = {
  O: "Pass",
  D: "Fail",
  NA: "NA",
};

function isCoverageMatrixStatusPath(path: string[]): boolean {
  if (path.length < 2) return false;
  const lastKey = path[path.length - 1];
  if (!COVERAGE_MATRIX_STATUS_KEYS.has(lastKey)) return false;
  return path.includes("coverageMatrix");
}

export function formatCoverageMatrixStatus(value: string): string {
  return COVERAGE_STATUS_LABELS[value] ?? value;
}

function pathToKey(path: string[]): string {
  return path.filter(Boolean).join(".");
}

function stripTemperatureSuffix(value: string): string {
  return value.trim().replace(/\s*°?\s*[Ff]\s*$/, "").trim();
}

function stripPsiSuffix(value: string): string {
  return value.trim().replace(/\s*[Pp][Ss][Ii]\s*$/, "").trim();
}

export function normalizeBonanTemperatureInput(value: string): string {
  return stripTemperatureSuffix(value);
}

export function normalizeBonanPsiInput(value: string): string {
  return stripPsiSuffix(value);
}

export function formatBonanTemperatureValue(value: string): string {
  const normalized = stripTemperatureSuffix(value);
  return normalized ? `${normalized} °F` : "";
}

export function formatBonanPsiValue(value: string): string {
  const normalized = stripPsiSuffix(value);
  return normalized ? `${normalized} PSI` : "";
}

export function normalizeBonanMainShutoffCondition(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "check" || normalized === "✅") return "check";
  if (normalized === "x" || normalized === "❌") return "x";
  return value;
}

export function formatBonanMainShutoffCondition(value: string): string {
  const normalized = normalizeBonanMainShutoffCondition(value);
  if (normalized === "check") return "✅";
  if (normalized === "x") return "❌";
  return value;
}

export function getBonanDailyFieldLabel(path: string[]): string | null {
  return LABEL_OVERRIDES[pathToKey(path)] || null;
}

export function formatBonanDailyPrimitiveValue(path: string[], value: unknown): string | null {
  if (typeof value !== "string") return null;

  const pathKey = pathToKey(path);
  if (TEMPERATURE_PATHS.has(pathKey)) {
    return formatBonanTemperatureValue(value);
  }
  if (PSI_PATHS.has(pathKey)) {
    return formatBonanPsiValue(value);
  }
  if (pathKey === "criticalWaterStructuralChecks.buildingMainShutoff.valveCondition") {
    return formatBonanMainShutoffCondition(value);
  }
  if (isCoverageMatrixStatusPath(path)) {
    return formatCoverageMatrixStatus(value);
  }

  return null;
}
