import { NextResponse } from "next/server";
import { z } from "zod";
import { getFindingById, getOrgForMember, logAudit, scanBelongsToOrg, setFindingStatus } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const bodySchema = z.object({ status: z.enum(["open", "acknowledged", "false_positive", "fixed"]) });

const UPDATE_FINDING_RATE_LIMIT = 200;
const UPDATE_FINDING_RATE_WINDOW_MS = 60 * 60_000;

// Any member (not just the owner) can triage a finding - acknowledging or
// marking something a false positive is routine day-to-day work, not a
// privileged action like adding a member or minting a token. Every change
// still lands in the audit log with who made it.
export const PATCH = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string; findingId: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, findingId } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const limitResult = rateLimit(`update-finding:${session.userId}`, UPDATE_FINDING_RATE_LIMIT, UPDATE_FINDING_RATE_WINDOW_MS);
  if (!limitResult.allowed) return NextResponse.json({ error: "too many requests, try again later" }, { status: 429 });

  const id = Number(findingId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid finding id" }, { status: 400 });

  const finding = await getFindingById(id);
  if (!finding || !(await scanBelongsToOrg(finding.scanId, resolved.org.id))) {
    return NextResponse.json({ error: "finding not found" }, { status: 404 });
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

  await setFindingStatus(id, parsed.data.status);
  await logAudit({
    orgId: resolved.org.id,
    actorUserId: session.userId,
    action: "finding.status_changed",
    targetType: "finding",
    targetId: id,
    metadata: { from: finding.status, to: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
});
