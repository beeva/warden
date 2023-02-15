import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrgForMember, getRepoBySlug, logAudit, updateRepoFailThreshold } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({ failThreshold: z.enum(["critical", "high", "medium", "low", "info"]) });

// Owner-only - this changes what a CI run treats as a hard block, which
// is a deploy-gating decision, not routine triage (unlike a finding's
// status, which any member can change).
export const PATCH = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string; repoSlug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, repoSlug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can change a repo's CI-gate threshold" }, { status: 403 });
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

  await updateRepoFailThreshold(repo.id, parsed.data.failThreshold);
  await logAudit({
    orgId: resolved.org.id,
    actorUserId: session.userId,
    action: "repo.fail_threshold_changed",
    targetType: "repo",
    targetId: repo.id,
    metadata: { from: repo.failThreshold, to: parsed.data.failThreshold },
  });

  return NextResponse.json({ ok: true });
});
