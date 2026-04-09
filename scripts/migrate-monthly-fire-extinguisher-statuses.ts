import { config } from "dotenv";
import { join } from "path";
import {
  normalizeMonthlyFireExtinguisherGauge,
  normalizeMonthlyFireExtinguisherPassFail,
  normalizeMonthlyFireExtinguisherYesNo,
} from "../lib/bonan-period-payloads";

const envResult = config({ path: join(process.cwd(), ".env.local") });
if (envResult.error) {
  console.warn("Warning: Could not load .env.local file:", envResult.error.message);
}

type JsonRecord = Record<string, unknown>;
const TL_CORP_PREPARED_BY = "TL Corp";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeElevatorName(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const normalized = raw.toLowerCase();
  if (!normalized) return raw;
  if (normalized === "north car 1") return "North Car A";
  if (normalized === "north car 2") return "North Car B";
  if (normalized === "south car 1") return "South Car A";
  if (normalized === "south car 2") return "South Car B";
  return raw;
}

async function migrateMonthlyFireExtinguisherStatuses() {
  const { turso } = await import("../lib/turso");

  console.log("Migrating monthly report dropdown values...");

  const result = await turso.execute({
    sql: `SELECT id, payload_json
          FROM bonan_reports
          WHERE report_type = 'monthly'`,
    args: [],
  });

  let updatedCount = 0;
  let parseErrorCount = 0;

  for (const row of result.rows) {
    const reportId = String(row.id || "");
    const payloadJson = typeof row.payload_json === "string" ? row.payload_json : "";
    if (!payloadJson) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadJson);
    } catch (error) {
      parseErrorCount += 1;
      console.warn(`Skipping monthly report ${reportId}: invalid payload JSON`, error);
      continue;
    }

    if (!isRecord(parsed)) continue;

    let changed = false;
    const nextPayload: JsonRecord = { ...parsed };

    const fireExtinguisherLog = parsed.fireExtinguisherLog;
    if (isRecord(fireExtinguisherLog) && Array.isArray(fireExtinguisherLog.rows)) {
      const nextRows = fireExtinguisherLog.rows.map((candidate) => {
        if (!isRecord(candidate)) return candidate;

        const nextGauge = normalizeMonthlyFireExtinguisherGauge(candidate.gauge);
        const nextPinSeal = normalizeMonthlyFireExtinguisherPassFail(candidate.pinSeal);
        const nextAccessible = normalizeMonthlyFireExtinguisherYesNo(candidate.accessible);
        const nextCondition = normalizeMonthlyFireExtinguisherPassFail(candidate.condition);

        if (
          candidate.gauge !== nextGauge ||
          candidate.pinSeal !== nextPinSeal ||
          candidate.accessible !== nextAccessible ||
          candidate.condition !== nextCondition
        ) {
          changed = true;
        }

        return {
          ...candidate,
          gauge: nextGauge,
          pinSeal: nextPinSeal,
          accessible: nextAccessible,
          condition: nextCondition,
        };
      });

      nextPayload.fireExtinguisherLog = {
        ...fireExtinguisherLog,
        rows: nextRows,
      };
    }

    const emergencyLightingLog = parsed.emergencyLightingLog;
    if (isRecord(emergencyLightingLog) && Array.isArray(emergencyLightingLog.rows)) {
      const nextRows = emergencyLightingLog.rows.map((candidate) => {
        if (!isRecord(candidate)) return candidate;

        const nextCondition = normalizeMonthlyFireExtinguisherPassFail(candidate.condition ?? candidate.passFail);
        if (candidate.condition !== nextCondition) {
          changed = true;
        }

        return {
          ...candidate,
          condition: nextCondition,
        };
      });

      nextPayload.emergencyLightingLog = {
        ...emergencyLightingLog,
        rows: nextRows,
      };
    }

    const deficiencyRegister = parsed.deficiencyRegister;
    if (isRecord(deficiencyRegister) && deficiencyRegister.preparedBy !== TL_CORP_PREPARED_BY) {
      changed = true;
      nextPayload.deficiencyRegister = {
        ...deficiencyRegister,
        preparedBy: TL_CORP_PREPARED_BY,
      };
    }

    const elevatorComplianceLog = parsed.elevatorComplianceLog;
    if (isRecord(elevatorComplianceLog) && Array.isArray(elevatorComplianceLog.rows)) {
      const nextRows = elevatorComplianceLog.rows.map((candidate) => {
        if (!isRecord(candidate)) return candidate;

        const nextElevator = normalizeElevatorName(candidate.elevator);
        const nextPermit = normalizeMonthlyFireExtinguisherYesNo(candidate.permit);
        const nextRideDoors = normalizeMonthlyFireExtinguisherPassFail(candidate.rideDoors);
        const nextAlarm = normalizeMonthlyFireExtinguisherPassFail(candidate.alarm);
        const nextPhone = normalizeMonthlyFireExtinguisherPassFail(candidate.phone);
        const nextCab = normalizeMonthlyFireExtinguisherPassFail(candidate.cab);

        if (
          candidate.elevator !== nextElevator ||
          candidate.permit !== nextPermit ||
          candidate.rideDoors !== nextRideDoors ||
          candidate.alarm !== nextAlarm ||
          candidate.phone !== nextPhone ||
          candidate.cab !== nextCab
        ) {
          changed = true;
        }

        return {
          ...candidate,
          elevator: nextElevator,
          permit: nextPermit,
          rideDoors: nextRideDoors,
          alarm: nextAlarm,
          phone: nextPhone,
          cab: nextCab,
        };
      });

      const nextElevatorComplianceLog: JsonRecord = {
        ...elevatorComplianceLog,
        rows: nextRows,
      };

      if ("northCar1Expiration" in nextElevatorComplianceLog && !("northCarAExpiration" in nextElevatorComplianceLog)) {
        nextElevatorComplianceLog.northCarAExpiration = nextElevatorComplianceLog.northCar1Expiration;
        changed = true;
      }
      if ("northCar2Expiration" in nextElevatorComplianceLog && !("northCarBExpiration" in nextElevatorComplianceLog)) {
        nextElevatorComplianceLog.northCarBExpiration = nextElevatorComplianceLog.northCar2Expiration;
        changed = true;
      }
      if ("southCar1Expiration" in nextElevatorComplianceLog && !("southCarAExpiration" in nextElevatorComplianceLog)) {
        nextElevatorComplianceLog.southCarAExpiration = nextElevatorComplianceLog.southCar1Expiration;
        changed = true;
      }
      if ("southCar2Expiration" in nextElevatorComplianceLog && !("southCarBExpiration" in nextElevatorComplianceLog)) {
        nextElevatorComplianceLog.southCarBExpiration = nextElevatorComplianceLog.southCar2Expiration;
        changed = true;
      }

      nextPayload.elevatorComplianceLog = {
        ...nextElevatorComplianceLog,
      };
    }

    if (!changed) continue;

    await turso.execute({
      sql: "UPDATE bonan_reports SET payload_json = ? WHERE id = ?",
      args: [JSON.stringify(nextPayload), reportId],
    });
    updatedCount += 1;
  }

  console.log(`Monthly reports updated: ${updatedCount}`);
  if (parseErrorCount > 0) {
    console.warn(`Monthly reports skipped due to invalid JSON: ${parseErrorCount}`);
  }
  console.log("Monthly report dropdown migration complete.");
}

migrateMonthlyFireExtinguisherStatuses().catch((error) => {
  console.error("Monthly report dropdown migration failed:", error);
  process.exit(1);
});
