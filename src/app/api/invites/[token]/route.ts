import { NextResponse } from "next/server";
import { getOrgById, getOrgInviteByToken } from "@/lib/db/queries";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

// Deliberately public, no session required - the accept page needs to
// show "you've been invited to join X as Y" before someone has signed up
// or logged in at all, the same preview-before-auth pattern Slack/GitHub
// invite links use. The token itself is the secret gating this, not a
// session; org name/role aren't sensitive enough to withhold from
// whoever already holds a valid link.
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const invite = await getOrgInviteByToken(token);
  if (!invite) return NextResponse.json({ error: "invite not found" }, { status: 404 });

  if (invite.acceptedByUserId) return NextResponse.json({ error: "invite already used" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "invite expired" }, { status: 410 });

  const org = await getOrgById(invite.orgId);
  if (!org) return NextResponse.json({ error: "invite not found" }, { status: 404 });

  return NextResponse.json({ orgName: org.name, role: invite.role });
});
