import {
  getEstimateDeliveryByToken,
  markEstimateEmailOpened,
} from "@/lib/projects";
import {
  sendEstimateEmailOpenedNotification,
} from "@/lib/email";

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
      const ipAddress =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null;
      const userAgent = request.headers.get("user-agent");

      const isFirstOpen = await markEstimateEmailOpened(
        delivery.id,
        ipAddress,
        userAgent
      );

      if (isFirstOpen) {
        sendEstimateEmailOpenedNotification({
          projectId: delivery.project_id,
          recipientEmail: delivery.sent_to_email,
          recipientName: delivery.recipient_name,
        }).catch(console.error);
      }
    }

    return new Response(TRANSPARENT_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error tracking estimate email open:", error);
    return new Response(TRANSPARENT_PNG, {
      headers: { "Content-Type": "image/png" },
    });
  }
}
