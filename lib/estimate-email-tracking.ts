import {
  getProjectById,
  markEstimateEmailOpened,
  type ProjectEstimateDelivery,
} from "@/lib/projects";
import { sendEstimateEmailOpenedNotification } from "@/lib/email";

export type EstimateEmailOpenSource = "logo" | "pixel" | "link" | "unknown";

function getRequestMeta(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent"),
  };
}

function isGmailImageProxy(request: Request): boolean {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  return ua.includes("googleimageproxy") || ua.includes("google-image-proxy");
}

/** How Gmail/ESP-style open tracking classifies the request (for admin copy). */
export function classifyEstimateEmailOpenSource(
  request: Request,
  explicitSource?: EstimateEmailOpenSource
): EstimateEmailOpenSource {
  if (explicitSource === "link") return "link";
  if (isGmailImageProxy(request)) {
    return "logo";
  }
  if (explicitSource === "logo" || explicitSource === "pixel") return explicitSource;
  return explicitSource ?? "unknown";
}

function openSourceLabel(source: EstimateEmailOpenSource): string {
  switch (source) {
    case "logo":
      return "opened the email (images loaded in inbox — typical Gmail behavior)";
    case "pixel":
      return "opened the email (tracking beacon)";
    case "link":
      return "clicked through to view the estimate";
    default:
      return "opened the estimate email";
  }
}

/** Marks first email open and notifies admins (logo, pixel, or link). */
export async function recordEstimateEmailOpenAndNotify(
  delivery: ProjectEstimateDelivery,
  request: Request,
  source: EstimateEmailOpenSource = "unknown",
  options: { notifyOnRepeat?: boolean } = {}
): Promise<boolean> {
  const { ipAddress, userAgent } = getRequestMeta(request);
  const resolvedSource = classifyEstimateEmailOpenSource(request, source);

  const channel =
    resolvedSource === "logo" || resolvedSource === "pixel" || resolvedSource === "link"
      ? resolvedSource
      : null;

  const isFirstOpen = await markEstimateEmailOpened(
    delivery.id,
    ipAddress,
    userAgent,
    channel
  );

  if (!isFirstOpen && !options.notifyOnRepeat) return false;

  const project = await getProjectById(delivery.project_id);

  await sendEstimateEmailOpenedNotification({
    projectId: delivery.project_id,
    projectName: project?.name ?? "Unknown project",
    estimateTotal: delivery.snapshot_total,
    recipientEmail: delivery.sent_to_email,
    recipientName: delivery.recipient_name,
    openDescription: openSourceLabel(resolvedSource),
  });

  return true;
}

export async function serveTrackedEstimateLogo(
  delivery: ProjectEstimateDelivery,
  request: Request
): Promise<Response> {
  const { getTlCorpLogoPng, TRACKING_IMAGE_RESPONSE_HEADERS } = await import(
    "./estimate-tracking-assets"
  );

  try {
    await recordEstimateEmailOpenAndNotify(delivery, request, "logo");
  } catch (error) {
    console.error("Error recording estimate logo open:", error);
  }

  const logo = await getTlCorpLogoPng();
  return new Response(new Uint8Array(logo), { headers: TRACKING_IMAGE_RESPONSE_HEADERS });
}
