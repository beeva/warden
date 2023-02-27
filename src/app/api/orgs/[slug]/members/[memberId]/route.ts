import { NextResponse } from "next/server";
import { countOrgOwners, getOrgForMember, getOrgMemberById, logAudit, removeOrgMember } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// Owner-only, same as adding a member. An owner can remove themselves
// (stepping down) as long as they're not the org's last owner - allowing
// that would leave the org with no one able to manage members, tokens,
// or repo settings, permanently.
export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string; memberId: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, memberId } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can remove a member" }, { status: 403 });
  }

  const id = Number(memberId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid member id" }, { status: 400 });

  const member = await getOrgMemberById(resolved.org.id, id);
  if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });

  if (member.role === "owner") {
    const ownerCount = await countOrgOwners(resolved.org.id);
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "cannot remove the last owner - transfer ownership first" }, { status: 409 });
    }
  }

  await removeOrgMember(resolved.org.id, member.userId);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "member.removed", targetType: "user", targetId: member.userId });

  return NextResponse.json({ ok: true });
});
