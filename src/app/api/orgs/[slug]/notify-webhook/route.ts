import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrgForMember, logAudit, setOrgNotifyWebhook } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { generateWebhookSecret } from "@/lib/notify/webhook";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// Any https:// URL is accepted (unlike the Slack webhook, this one isn't
// restricted to a single provider's domain) - the signature this app
// sends on every delivery is what lets the receiver trust it, not the
// URL being secret or from a known vendor.
const bodySchema = z.object({ notifyWebhookUrl: z.string().url().startsWith("https://").max(500).nullable() });

// Owner-only, same sensitivity tier as the Slack webhook and an API
// token - whoever can set this can redirect every future blocked-scan
// notification (and the signing secret minted alongside it) to a URL
// they control.
export const PATCH = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can change the notify webhook" }, { status: 403 });
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

  // Clearing the URL clears the secret with it - a secret with no
  // webhook to sign for is dead weight, and reconnecting always mints a
  // fresh one rather than resurrecting the old value.
  const secret = parsed.data.notifyWebhookUrl ? generateWebhookSecret() : null;
  await setOrgNotifyWebhook(resolved.org.id, parsed.data.notifyWebhookUrl, secret);
  await logAudit({
    orgId: resolved.org.id,
    actorUserId: session.userId,
    action: parsed.data.notifyWebhookUrl ? "notify_webhook.connected" : "notify_webhook.disconnected",
    targetType: "org",
    targetId: resolved.org.id,
  });

  // The only point this secret is ever returned - like an API token's
  // raw value, only its effect (a valid signature on future deliveries)
  // is checkable after this response.
  return NextResponse.json({ ok: true, secret });
});
