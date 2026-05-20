import { readFile } from "fs/promises";
import { join } from "path";

let logoPngCache: Buffer | null = null;

export async function getTlCorpLogoPng(): Promise<Buffer> {
  if (!logoPngCache) {
    const candidates = ["NoTextLogoFIXED.png", "site-icon-from-ico.png"];
    for (const file of candidates) {
      try {
        logoPngCache = await readFile(join(process.cwd(), "public", file));
        break;
      } catch {
        // try next
      }
    }
    if (!logoPngCache) {
      throw new Error("TL Corp logo not found in public/");
    }
  }
  return logoPngCache;
}

/** Per-recipient URL — Gmail prefetches visible images much sooner than hidden pixels. */
export function getEstimateTrackingLogoUrl(deliveryToken: string): string {
  const base = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}/api/tracking/estimate/${deliveryToken}/logo`;
}

export function getEstimateTrackingPixelUrl(deliveryToken: string): string {
  const base = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}/api/tracking/estimate/${deliveryToken}/open`;
}

export const TRACKING_IMAGE_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Type": "image/png",
  // Unique URL per delivery; Gmail/GoogleImageProxy can cache without blocking first open signal.
  "Cache-Control": "public, max-age=86400",
};
