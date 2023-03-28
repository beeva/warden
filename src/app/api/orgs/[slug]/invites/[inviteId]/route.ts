import { NextResponse } from "next/server";
import { getOrgForMember, getOrgInviteScoped, logAudit, revokeOrgInvite } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string; inviteId: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, inviteId } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") return NextResponse.json({ error: "only an org owner can revoke invites" }, { status: 403 });

  const id = Number(inviteId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid invite id" }, { status: 400 });

  const invite = await getOrgInviteScoped(resolved.org.id, id);
  if (!invite) return NextResponse.json({ error: "invite not found" }, { status: 404 });

  await revokeOrgInvite(id);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "invite.revoked", targetType: "org_invite", targetId: id });

  return NextResponse.json({ ok: true });
});
