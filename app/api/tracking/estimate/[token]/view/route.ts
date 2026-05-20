import { NextResponse } from "next/server";
import { getEstimateDeliveryByToken } from "@/lib/projects";
import { recordEstimateEmailOpenAndNotify } from "@/lib/estimate-email-tracking";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    new URL(request.url).origin
  ).replace(/\/+$/, "");

  try {
    const delivery = await getEstimateDeliveryByToken(token);

    if (delivery && delivery.status === "sent") {
      await recordEstimateEmailOpenAndNotify(delivery, request, "link", {
        notifyOnRepeat: true,
      });
    }

    return NextResponse.redirect(`${appUrl}/estimate/${token}`, 302);
  } catch (error) {
    console.error("Error tracking estimate link click:", error);
    return NextResponse.redirect(`${appUrl}/estimate/${token}`, 302);
  }
}
