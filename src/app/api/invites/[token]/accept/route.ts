import { NextResponse } from "next/server";
import { acceptOrgInvite, getMembership, getOrgById, getOrgInviteByToken } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// Requires a session, unlike the GET lookup above - joining an org is a
// real state change, so this is the point identity actually has to be
// established, not just previewed.
export const POST = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ token: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const { token } = await params;
  const invite = await getOrgInviteByToken(token);
  if (!invite) return NextResponse.json({ error: "invite not found" }, { status: 404 });
  if (invite.acceptedByUserId) return NextResponse.json({ error: "invite already used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "invite expired" }, { status: 410 });

  const org = await getOrgById(invite.orgId);
  if (!org) return NextResponse.json({ error: "invite not found" }, { status: 404 });

  const existing = await getMembership(org.id, session.userId);
  if (existing) return NextResponse.json({ error: "already a member of this org" }, { status: 409 });

  await acceptOrgInvite(invite.id, org.id, session.userId, invite.role);

  return NextResponse.json({ orgSlug: org.slug });
});
