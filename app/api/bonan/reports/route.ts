import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { createBonanReport, getBonanReports } from "@/lib/bonan-reports";
import type { BonanReportStatus, BonanReportType } from "@/lib/bonan-types";

function isValidReportType(value: string): value is BonanReportType {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function isValidReportStatus(value: string): value is BonanReportStatus {
  return value === "draft" || value === "submitted";
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
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
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
      status: status,
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

    if (reportTypeRaw !== "daily") {
      return Response.json(
        { error: "Weekly and monthly Bonan reports are not enabled yet." },
        { status: 400 }
      );
    }

    const report = await createBonanReport({
      report_type: reportTypeRaw,
      created_by: user.id,
      site: "bonan_towers",
    });

    return Response.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Error creating Bonan report:", error);
    return Response.json({ error: "Failed to create Bonan report" }, { status: 500 });
  }
}
