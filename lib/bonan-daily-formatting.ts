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
  "criticalWaterStructuralChecks.boilerRoom.gaugeLeftSuctionPsi": "Gauge Left Suction",
  "criticalWaterStructuralChecks.boilerRoom.gaugeRightDischargePsi": "Gauge Right Suction",
  "criticalWaterStructuralChecks.boilerRoom.pump1SuctionPsi": "Pump 1 Suction",
  "criticalWaterStructuralChecks.boilerRoom.pump1DischargePsi": "Pump 1 Discharge",
  "criticalWaterStructuralChecks.boilerRoom.pump2SuctionPsi": "Pump 2 Suction",
  "criticalWaterStructuralChecks.boilerRoom.pump2DischargePsi": "Pump 2 Discharge",
  "criticalWaterStructuralChecks.boilerRoom.airCompressorPsi": "Air Compressor",
};

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

  return null;
}
