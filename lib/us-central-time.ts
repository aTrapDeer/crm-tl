export const US_CENTRAL_TIME_ZONE = "America/Chicago";

type DateInput = Date | string | number;

function toPartsMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return map;
}

function parseDateInput(value: DateInput): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  const input = value.trim();
  if (!input) return null;

  // SQLite datetime('now') style: YYYY-MM-DD HH:MM:SS (UTC)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)) {
    const date = new Date(input.replace(" ", "T") + "Z");
    return Number.isFinite(date.getTime()) ? date : null;
  }

  // ISO without timezone suffix.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(input)) {
    const date = new Date(input + "Z");
    return Number.isFinite(date.getTime()) ? date : null;
  }

  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getUsCentralDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: US_CENTRAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = toPartsMap(parts);
  return `${map.year}-${map.month}-${map.day}`;
}

export function getUsCentralTimeHHMM(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: US_CENTRAL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map = toPartsMap(parts);
  return `${map.hour}:${map.minute}`;
}

export function formatUsCentralDateTime(value: DateInput): string {
  const date = parseDateInput(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: US_CENTRAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatUsCentralTime(value: DateInput): string {
  const date = parseDateInput(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: US_CENTRAL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

