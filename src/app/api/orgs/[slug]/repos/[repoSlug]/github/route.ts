import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrgForMember, getRepoBySlug, logAudit, setRepoGithubConfig } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({ cloneUrl: z.string().url().max(500) });

// Owner-only - connecting a repo means Warden will shallow-clone
// whatever URL is given here on every push, so this is equivalent in
// sensitivity to minting an API token.
export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string; repoSlug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, repoSlug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can connect GitHub" }, { status: 403 });
  }

  const repo = await getRepoBySlug(resolved.org.id, repoSlug);
  if (!repo) return NextResponse.json({ error: "repo not found" }, { status: 404 });

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

  // A fresh secret every time this is called, including on
  // reconnect/rotate - the stored secret is the credential a forged
  // request would need, and the raw value is only ever returned in this
  // one response, matching the API token pattern.
  const webhookSecret = randomBytes(24).toString("hex");
  await setRepoGithubConfig(repo.id, parsed.data.cloneUrl, webhookSecret);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "github.connected", targetType: "repo", targetId: repo.id });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3522";
  return NextResponse.json({
    webhookUrl: `${appUrl}/api/webhooks/github/${slug}/${repoSlug}`,
    webhookSecret,
  });
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string; repoSlug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, repoSlug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can disconnect GitHub" }, { status: 403 });
  }

  const repo = await getRepoBySlug(resolved.org.id, repoSlug);
  if (!repo) return NextResponse.json({ error: "repo not found" }, { status: 404 });

  await setRepoGithubConfig(repo.id, null, null);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "github.disconnected", targetType: "repo", targetId: repo.id });

  return NextResponse.json({ ok: true });
});
