import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrgInvite, getOrgForMember, listPendingOrgInvites, logAudit } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const CREATE_INVITE_RATE_LIMIT = 20;
const CREATE_INVITE_RATE_WINDOW_MS = 60 * 60_000;

export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") return NextResponse.json({ error: "only an org owner can view invites" }, { status: 403 });

  const invites = await listPendingOrgInvites(resolved.org.id);
  return NextResponse.json({ invites });
});

const bodySchema = z.object({ role: z.enum(["owner", "member"]).default("member") });

// Owner-only - a shareable link, not an email (there's no email service
// in this deployment). Whoever holds the link can join as the role it
// was created for, so minting one is equivalent in sensitivity to
// adding a member directly.
export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });
  if (resolved.membership.role !== "owner") return NextResponse.json({ error: "only an org owner can create invites" }, { status: 403 });

  const limitResult = rateLimit(`create-invite:${session.userId}`, CREATE_INVITE_RATE_LIMIT, CREATE_INVITE_RATE_WINDOW_MS);
  if (!limitResult.allowed) return NextResponse.json({ error: "too many requests, try again later" }, { status: 429 });

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

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS);
  const invite = await createOrgInvite(resolved.org.id, token, parsed.data.role, session.userId, expiresAt);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "invite.created", targetType: "org_invite", targetId: invite.id, metadata: { role: parsed.data.role } });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3522";
  return NextResponse.json({ invite, inviteUrl: `${appUrl}/invites/${token}` }, { status: 201 });
});
