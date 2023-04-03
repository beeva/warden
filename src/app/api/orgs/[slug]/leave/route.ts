import { NextResponse } from "next/server";
import { countOrgOwners, getOrgForMember, logAudit, removeOrgMember } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// Self-service - any member (including an owner, as long as they're not
// the last one) can remove themselves without needing another owner to
// do it for them. The last-owner guard is the same one member removal
// already has; leaving as the sole owner would orphan the org exactly
// the same way removing them would.
export const POST = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role === "owner") {
    const ownerCount = await countOrgOwners(resolved.org.id);
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "you're the last owner - transfer ownership or delete the org instead" }, { status: 409 });
    }
  }

  await removeOrgMember(resolved.org.id, session.userId);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "member.left", targetType: "user", targetId: session.userId });

  return NextResponse.json({ ok: true });
});
