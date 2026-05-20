import { getEstimateDeliveryByToken } from "@/lib/projects";
import { serveTrackedEstimateLogo } from "@/lib/estimate-email-tracking";
import {
  getTlCorpLogoPng,
  TRACKING_IMAGE_RESPONSE_HEADERS,
} from "@/lib/estimate-tracking-assets";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const delivery = await getEstimateDeliveryByToken(token);

    if (delivery && delivery.status === "sent") {
      return serveTrackedEstimateLogo(delivery, request);
    }

    const logo = await getTlCorpLogoPng();
    return new Response(new Uint8Array(logo), {
      headers: TRACKING_IMAGE_RESPONSE_HEADERS,
    });
  } catch (error) {
    console.error("Error serving tracked estimate logo:", error);
    try {
      const logo = await getTlCorpLogoPng();
      return new Response(new Uint8Array(logo), {
        headers: TRACKING_IMAGE_RESPONSE_HEADERS,
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  }
}
