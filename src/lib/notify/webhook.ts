import { createHmac, randomBytes } from "node:crypto";
import type { Severity } from "@/lib/db/schema";

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

export interface BlockedScanWebhookPayload {
  event: "scan.blocked";
  org: string;
  repo: string;
  scanId: number;
  counts: Record<Severity, number>;
  dashboardUrl: string;
  timestamp: string;
}

/** Same scheme this app already verifies on the inbound GitHub webhook side (HMAC-SHA256 over the raw body, hex-encoded) - a receiver can confirm this request actually came from warden and wasn't forged against a guessed URL. */
export function signWebhookBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

/**
 * A generic outbound notification for anything Slack doesn't cover - a
 * custom relay into Discord/Teams, an internal incident pipeline. Unlike
 * sendSlackNotification, the payload is signed, since the receiving
 * endpoint only has this URL (not a bearer credential) to go on.
 * Delivery failure is non-fatal to the caller, matching Slack's own
 * notify-is-best-effort behavior - a completed, correctly recorded scan
 * should never be reported as failed over a notification problem.
 */
export async function sendWebhookNotification(webhookUrl: string, secret: string, payload: BlockedScanWebhookPayload): Promise<void> {
  const body = JSON.stringify(payload);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-warden-signature": signWebhookBody(body, secret),
        "x-warden-event": payload.event,
      },
      body,
    });
    if (!response.ok) {
      console.error(`notify webhook returned ${response.status}`);
    }
  } catch (err) {
    console.error("notify webhook delivery failed:", err);
  }
}
