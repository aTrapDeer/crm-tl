import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { createBonanReport, getBonanReportByDate, getBonanReports } from "@/lib/bonan-reports";
import type { BonanReportStatus, BonanReportType } from "@/lib/bonan-types";
import { getMonthStartDate, getUsCentralDate, getWeekStartSunday } from "@/lib/us-central-time";
import { userHasBonanClientMembership } from "@/lib/bonan-client";

function isValidReportType(value: string): value is BonanReportType {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function isValidReportStatus(value: string): value is BonanReportStatus {
  return value === "draft" || value === "submitted";
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function normalizeReportDateForType(reportType: BonanReportType, reportDate?: string): string {
  const baseDate = reportDate || getUsCentralDate();
  if (reportType === "weekly") return getWeekStartSunday(baseDate);
  if (reportType === "monthly") return getMonthStartDate(baseDate);
  return baseDate;
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  return user;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client" && !(await userHasBonanClientMembership(user.id))) {
      return Response.json({ error: "Bonan access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportTypeParam = searchParams.get("report_type");
    const statusParam = searchParams.get("status");

    let reportType: BonanReportType | undefined;
    let status: BonanReportStatus | undefined;

    if (reportTypeParam) {
      if (!isValidReportType(reportTypeParam)) {
        return Response.json({ error: "Invalid report type" }, { status: 400 });
      }
      reportType = reportTypeParam;
    }
    if (statusParam) {
      if (!isValidReportStatus(statusParam)) {
        return Response.json({ error: "Invalid report status" }, { status: 400 });
      }
      status = statusParam;
    }

    const reports = await getBonanReports({
      report_type: reportType,
      status: user.role === "client" ? "submitted" : status,
    });

    return Response.json({ reports });
  } catch (error) {
    console.error("Error fetching Bonan reports:", error);
    return Response.json({ error: "Failed to fetch Bonan reports" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const reportTypeRaw = typeof body.report_type === "string" ? body.report_type : "daily";

    if (!isValidReportType(reportTypeRaw)) {
      return Response.json({ error: "Invalid report type" }, { status: 400 });
    }

    let reportDate: string | undefined;
    if (body.report_date !== undefined) {
      if (typeof body.report_date !== "string" || !isValidIsoDate(body.report_date)) {
        return Response.json({ error: "Invalid report_date. Use YYYY-MM-DD." }, { status: 400 });
      }
      reportDate = body.report_date;
    }

    const normalizedReportDate = normalizeReportDateForType(reportTypeRaw, reportDate);

    const existingReport = await getBonanReportByDate({
      report_type: reportTypeRaw,
      report_date: normalizedReportDate,
      site: "bonan_towers",
    });
    if (existingReport) {
      const typeLabel = reportTypeRaw === "daily" ? "daily" : reportTypeRaw === "weekly" ? "weekly" : "monthly";
      return Response.json(
        {
          error: `A ${typeLabel} report already exists for this period.`,
          existingReport: {
            id: existingReport.id,
            report_date: existingReport.report_date,
            status: existingReport.status,
          },
        },
        { status: 409 }
      );
    }

    const report = await createBonanReport({
      report_type: reportTypeRaw,
      created_by: user.id,
      site: "bonan_towers",
      report_date: normalizedReportDate,
    });

    return Response.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Error creating Bonan report:", error);
    return Response.json({ error: "Failed to create Bonan report" }, { status: 500 });
  }
}
