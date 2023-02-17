import type { Severity } from "@/lib/db/schema";

export interface BlockedScanNotification {
  orgName: string;
  repoName: string;
  scanId: number;
  counts: Record<Severity, number>;
  dashboardUrl: string;
}

/** Pure - the message shape is unit-tested independent of any real network call. */
export function formatBlockedScanMessage(input: BlockedScanNotification): { text: string } {
  const parts = (["critical", "high", "medium", "low", "info"] as Severity[])
    .filter((severity) => input.counts[severity] > 0)
    .map((severity) => `${input.counts[severity]} ${severity}`);

  return {
    text: `:warden: *${input.orgName}/${input.repoName}* - scan #${input.scanId} blocked (${parts.join(", ")}). <${input.dashboardUrl}|View findings>`,
  };
}

/**
 * A Slack incoming webhook URL is itself the credential - anyone who has
 * it can post as this integration, so there's no separate signature to
 * verify on the way out (unlike the inbound slash-command direction,
 * which does need one). Failure here is deliberately non-fatal to the
 * caller: a scan that completed and was correctly recorded shouldn't be
 * reported as failed just because a notification couldn't be delivered.
 */
export async function sendSlackNotification(webhookUrl: string, message: { text: string }): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      console.error(`slack webhook returned ${response.status}`);
    }
  } catch (err) {
    console.error("slack webhook delivery failed:", err);
  }
}
