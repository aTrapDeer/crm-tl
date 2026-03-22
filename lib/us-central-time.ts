export const US_CENTRAL_TIME_ZONE = "America/Chicago";

type DateInput = Date | string | number;

function toIsoDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUtcDateOnly(value: DateInput): Date | null {
  const parsed = parseDateInput(value);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

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

/** Work order `time_received` and similar fields are stored as 24-hour HH:mm (or HH:mm:ss). */
export function formatWallClockTime12Hour(time: string | null | undefined): string {
  if (time == null) return "";
  const trimmed = String(time).trim();
  if (!trimmed) return "";

  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!m) return trimmed;

  const h = parseInt(m[1], 10);
  const minute = m[2];
  if (!Number.isFinite(h) || h < 0 || h > 23) return trimmed;
  const mi = parseInt(minute, 10);
  if (!Number.isFinite(mi) || mi < 0 || mi > 59) return trimmed;

  const suffix = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${minute} ${suffix}`;
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

export function getWeekStartSunday(value: DateInput = new Date()): string {
  const date = toUtcDateOnly(value);
  if (!date) return getUsCentralDate();

  const dayIndex = date.getUTCDay();
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - dayIndex);
  return toIsoDateUtc(start);
}

export function getWeekEndSaturday(value: DateInput = new Date()): string {
  const weekStart = getWeekStartSunday(value);
  return addDaysToIsoDate(weekStart, 6);
}

export function getMonthStartDate(value: DateInput = new Date()): string {
  const date = toUtcDateOnly(value);
  if (!date) return getUsCentralDate();

  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return toIsoDateUtc(start);
}

export function getMonthEndDate(value: DateInput = new Date()): string {
  const date = toUtcDateOnly(value);
  if (!date) return getUsCentralDate();

  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return toIsoDateUtc(end);
}

export function getMonthKey(value: DateInput = new Date()): string {
  const start = getMonthStartDate(value);
  return start.slice(0, 7);
}

export function getDaysInIsoMonth(value: DateInput = new Date()): number {
  const date = toUtcDateOnly(value);
  if (!date) return 30;

  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return end.getUTCDate();
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = toUtcDateOnly(isoDate);
  if (!date) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDateUtc(date);
}
