import { cookies, headers } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import { getBonanReportById, updateBonanReport } from "@/lib/bonan-reports";
import {
  getBonanReportSignatures,
  upsertBonanReportSignature,
  type BonanReportSignatureScope,
} from "@/lib/bonan-report-signatures";
import { normalizeDailyReportPayload } from "@/lib/bonan-types";
import { userHasBonanClientMembership } from "@/lib/bonan-client";

function isDataImage(value: string): boolean {
  return /^data:image\/(png|jpeg|jpg);base64,/.test(value);
}

function parseSignatureScope(value: unknown): BonanReportSignatureScope | null {
  return value === "daily_walkthrough" || value === "fire_alarm"
    ? value
    : null;
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  return getUserById(session.user_id);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const report = await getBonanReportById(id);
    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }

    if (user.role === "client") {
      if (!(await userHasBonanClientMembership(user.id))) {
        return Response.json({ error: "Bonan access denied" }, { status: 403 });
      }
      if (report.status !== "submitted") {
        return Response.json({ error: "Bonan report is not available to clients yet" }, { status: 403 });
      }
    }

    const signatures = await getBonanReportSignatures(id);
    return Response.json({ signatures });
  } catch (error) {
    console.error("Error fetching Bonan report signatures:", error);
    return Response.json(
      { error: "Failed to fetch Bonan report signatures" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "client") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const report = await getBonanReportById(id);
    if (!report) {
      return Response.json({ error: "Bonan report not found" }, { status: 404 });
    }
    if (report.report_type !== "daily") {
      return Response.json(
        { error: "Only daily Bonan reports support walkthrough signatures." },
        { status: 400 }
      );
    }
    if (report.status === "submitted") {
      return Response.json(
        { error: "Submitted Bonan reports are locked and cannot be edited." },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const signatureScope = parseSignatureScope(body.signature_scope);
    const signerName =
      typeof body.signer_name === "string" ? body.signer_name.trim() : "";
    const signerTitle =
      typeof body.signer_title === "string" ? body.signer_title.trim() : "";
    const signatureData =
      typeof body.signature_data === "string" ? body.signature_data : "";

    if (!signatureScope || !signerName || !signatureData) {
      return Response.json(
        {
          error:
            "Signature scope, signer name, and signature data are required",
        },
        { status: 400 }
      );
    }

    if (!isDataImage(signatureData)) {
      return Response.json(
        { error: "Signature must be a PNG or JPEG data URL" },
        { status: 400 }
      );
    }

    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      null;

    const signature = await upsertBonanReportSignature({
      bonan_report_id: id,
      signature_scope: signatureScope,
      signer_name: signerName,
      signer_title: signerTitle || null,
      signature_data: signatureData,
      signed_by: user.id,
      ip_address: ipAddress,
    });

    const payload = normalizeDailyReportPayload(report.payload);
    if (signatureScope === "daily_walkthrough") {
      payload.metadata.signature = signerName;
    } else {
      payload.fireAlarmMeta.signature = signerName;
    }
    const updatedReport = await updateBonanReport(id, { payload });
    const signatures = await getBonanReportSignatures(id);

    return Response.json({ signature, signatures, report: updatedReport });
  } catch (error) {
    console.error("Error saving Bonan report signature:", error);
    return Response.json(
      { error: "Failed to save Bonan report signature" },
      { status: 500 }
    );
  }
}
