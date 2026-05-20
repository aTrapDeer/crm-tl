import { getEstimateDeliveryByToken } from "@/lib/projects";
import { recordEstimateEmailOpenAndNotify } from "@/lib/estimate-email-tracking";
import { TRACKING_IMAGE_RESPONSE_HEADERS } from "@/lib/estimate-tracking-assets";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const delivery = await getEstimateDeliveryByToken(token);

    if (delivery && delivery.status === "sent") {
      await recordEstimateEmailOpenAndNotify(delivery, request, "pixel");
    }

    return new Response(TRANSPARENT_PNG, { headers: TRACKING_IMAGE_RESPONSE_HEADERS });
  } catch (error) {
    console.error("Error tracking estimate email open:", error);
    return new Response(TRANSPARENT_PNG, { headers: TRACKING_IMAGE_RESPONSE_HEADERS });
  }
}
