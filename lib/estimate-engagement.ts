import type { ProjectEstimateDelivery, ProjectEstimateEvent } from "./projects";

export type EmailOpenChannel = "logo" | "pixel" | "link" | "unknown";
export type EstimateViewChannel = "public_link" | "portal" | "unknown";

export interface EngagementSignal {
  confidencePercent: number;
  headline: string;
  detail: string;
  at: string | null;
}

export interface EstimateEngagementSummary {
  recipientEmail: string;
  recipientName: string | null;
  sentAt: string;
  sentTotal: number;
  email: EngagementSignal;
  estimate: EngagementSignal;
}

function isGmailImageProxyUserAgent(userAgent: string | null): boolean {
  const ua = (userAgent || "").toLowerCase();
  return ua.includes("googleimageproxy") || ua.includes("google-image-proxy");
}

export function inferEmailOpenChannel(event: ProjectEstimateEvent): EmailOpenChannel {
  const stored = event.channel as EmailOpenChannel | null | undefined;
  if (stored === "logo" || stored === "pixel" || stored === "link") return stored;
  if (isGmailImageProxyUserAgent(event.user_agent)) return "logo";
  return "unknown";
}

export function inferEstimateViewChannel(event: ProjectEstimateEvent): EstimateViewChannel {
  const stored = event.channel as EstimateViewChannel | null | undefined;
  if (stored === "public_link" || stored === "portal") return stored;
  if (event.user_id) return "portal";
  return "public_link";
}

function buildEmailSignal(
  delivery: ProjectEstimateDelivery,
  events: ProjectEstimateEvent[]
): EngagementSignal {
  if (!delivery.email_opened_at) {
    return {
      confidencePercent: 0,
      headline: "No activity yet",
      detail: "We have not detected that the client opened the billing email.",
      at: null,
    };
  }

  const openEvent =
    events.find((e) => e.event_type === "email_opened") ?? null;
  const channel = openEvent ? inferEmailOpenChannel(openEvent) : "unknown";

  switch (channel) {
    case "link":
      return {
        confidencePercent: 92,
        headline: "Very likely seen",
        detail: "Client clicked through from the billing email.",
        at: delivery.email_opened_at,
      };
    case "logo":
      return {
        confidencePercent: 78,
        headline: "Likely seen in inbox",
        detail: "Email images loaded — typical when Gmail or Apple shows the message.",
        at: delivery.email_opened_at,
      };
    case "pixel":
      return {
        confidencePercent: 52,
        headline: "May have opened",
        detail: "A secondary tracking signal fired; less reliable than the branded logo load.",
        at: delivery.email_opened_at,
      };
    default:
      return {
        confidencePercent: 62,
        headline: "Possibly opened",
        detail: "An open was recorded, but the inbox provider did not identify how.",
        at: delivery.email_opened_at,
      };
  }
}

function buildEstimateSignal(
  delivery: ProjectEstimateDelivery,
  events: ProjectEstimateEvent[]
): EngagementSignal {
  if (!delivery.first_viewed_at) {
    return {
      confidencePercent: 0,
      headline: "Not opened yet",
      detail: "The estimate has not been viewed online or in the Portal.",
      at: null,
    };
  }

  const viewEvent = events.find((e) => e.event_type === "viewed_in_app");
  const channel = viewEvent ? inferEstimateViewChannel(viewEvent) : "unknown";

  switch (channel) {
    case "portal":
      return {
        confidencePercent: 100,
        headline: "Opened in Portal",
        detail: "Viewed while signed into the client Portal.",
        at: delivery.first_viewed_at,
      };
    case "public_link":
      return {
        confidencePercent: 100,
        headline: "Opened online",
        detail: "Viewed via the secure link from the billing email.",
        at: delivery.first_viewed_at,
      };
    default:
      return {
        confidencePercent: 88,
        headline: "Opened",
        detail: "The estimate was viewed; the entry path was not recorded.",
        at: delivery.first_viewed_at,
      };
  }
}

export function buildEstimateEngagementSummary(
  delivery: ProjectEstimateDelivery,
  events: ProjectEstimateEvent[]
): EstimateEngagementSummary {
  return {
    recipientEmail: delivery.sent_to_email,
    recipientName: delivery.recipient_name ?? null,
    sentAt: delivery.sent_at,
    sentTotal: delivery.snapshot_total,
    email: buildEmailSignal(delivery, events),
    estimate: buildEstimateSignal(delivery, events),
  };
}
