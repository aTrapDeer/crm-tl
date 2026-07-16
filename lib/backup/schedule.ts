import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const BACKUP_TIMEZONE = "America/Chicago";

/** Only this account can see the backup panel and trigger manual backups. */
export const BACKUP_MANAGER_EMAIL = "andrewrapier@beatitat.com";

export function canManageBackups(email: string) {
  return email.trim().toLowerCase() === BACKUP_MANAGER_EMAIL;
}

/**
 * The Vercel crons fire at both 05:00 and 06:00 UTC so one of them always
 * lands in the midnight hour in Central time regardless of DST. This guard
 * lets the handler skip the run that lands at 11pm or 1am local.
 */
export function isMidnightHourCentral(now: Date = new Date()) {
  return formatInTimeZone(now, BACKUP_TIMEZONE, "H") === "0";
}

/** UTC instant of the next midnight in Central time. */
export function getNextScheduledBackup(now: Date = new Date()): Date {
  const todayCentral = formatInTimeZone(now, BACKUP_TIMEZONE, "yyyy-MM-dd");
  const [year, month, day] = todayCentral.split("-").map(Number);
  // Date.UTC normalizes day overflow (e.g. Jul 32 -> Aug 1), giving us
  // tomorrow's calendar date in Central; fromZonedTime pins it to midnight.
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowCentral = formatInTimeZone(tomorrow, "UTC", "yyyy-MM-dd");
  return fromZonedTime(`${tomorrowCentral}T00:00:00`, BACKUP_TIMEZONE);
}

export function formatCentral(date: Date) {
  return formatInTimeZone(date, BACKUP_TIMEZONE, "EEE, MMM d 'at' h:mm a zzz");
}
