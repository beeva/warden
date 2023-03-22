import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteRepo, getOrgForMember, getRepoBySlug, logAudit, updateRepoFailThreshold, updateRepoIgnoredRules } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    failThreshold: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
    ignoredRuleIds: z.array(z.string().min(1).max(200)).max(50).optional(),
  })
  .refine((body) => body.failThreshold !== undefined || body.ignoredRuleIds !== undefined, { message: "at least one field is required" });

// Owner-only - both fields change what a CI run treats as a hard block
// (the threshold directly, ignored rules by removing findings from
// consideration entirely), which is a deploy-gating decision, not
// routine triage (unlike a finding's status, which any member can
// change).
export const PATCH = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string; repoSlug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, repoSlug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can change repo settings" }, { status: 403 });
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

  if (parsed.data.failThreshold !== undefined) {
    await updateRepoFailThreshold(repo.id, parsed.data.failThreshold);
    await logAudit({
      orgId: resolved.org.id,
      actorUserId: session.userId,
      action: "repo.fail_threshold_changed",
      targetType: "repo",
      targetId: repo.id,
      metadata: { from: repo.failThreshold, to: parsed.data.failThreshold },
    });
  }

  if (parsed.data.ignoredRuleIds !== undefined) {
    await updateRepoIgnoredRules(repo.id, parsed.data.ignoredRuleIds);
    await logAudit({
      orgId: resolved.org.id,
      actorUserId: session.userId,
      action: "repo.ignored_rules_changed",
      targetType: "repo",
      targetId: repo.id,
      metadata: { from: repo.ignoredRuleIds, to: parsed.data.ignoredRuleIds },
    });
  }

  return NextResponse.json({ ok: true });
});

// Owner-only - deletes every scan and finding for this repo along with it
// (ON DELETE CASCADE), an irreversible action equivalent in blast radius
// to revoking every credential in one step.
export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string; repoSlug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, repoSlug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can delete a repo" }, { status: 403 });
  }

  const repo = await getRepoBySlug(resolved.org.id, repoSlug);
  if (!repo) return NextResponse.json({ error: "repo not found" }, { status: 404 });

  await deleteRepo(repo.id);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "repo.deleted", targetType: "repo", targetId: repo.id, metadata: { name: repo.name, slug: repo.slug } });

  return NextResponse.json({ ok: true });
});
