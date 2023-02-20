import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrgForMember, logAudit, setOrgSlackWebhookUrl } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// null clears the webhook (disconnects Slack); a non-null value must be
// a real https:// URL - Slack's own incoming webhooks are always https,
// and accepting an arbitrary scheme here would let an owner point
// "notifications" at an internal http:// service instead (a mild SSRF
// vector - this app's own server would be the one making the request).
const bodySchema = z.object({ slackWebhookUrl: z.string().url().startsWith("https://").max(500).nullable() });

// Owner-only - the webhook URL is itself the credential, equivalent in
// sensitivity to an API token.
export const PATCH = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can change the Slack webhook" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  }

  await setOrgSlackWebhookUrl(resolved.org.id, parsed.data.slackWebhookUrl);
  await logAudit({
    orgId: resolved.org.id,
    actorUserId: session.userId,
    action: parsed.data.slackWebhookUrl ? "slack.connected" : "slack.disconnected",
    targetType: "org",
    targetId: resolved.org.id,
  });

  return NextResponse.json({ ok: true });
});
