import { NextResponse } from "next/server";
import { deleteApiToken, getOrgForMember, listApiTokensForOrg, logAudit } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const REVOKE_TOKEN_RATE_LIMIT = 20;
const REVOKE_TOKEN_RATE_WINDOW_MS = 60 * 60_000;

export const DELETE = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string; tokenId: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, tokenId } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can revoke API tokens" }, { status: 403 });
  }

  const limitResult = rateLimit(`revoke-token:${session.userId}`, REVOKE_TOKEN_RATE_LIMIT, REVOKE_TOKEN_RATE_WINDOW_MS);
  if (!limitResult.allowed) return NextResponse.json({ error: "too many requests, try again later" }, { status: 429 });

  const id = Number(tokenId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid token id" }, { status: 400 });

  // Scoped to this org's own tokens, not a bare delete-by-id - otherwise
  // an owner of org A could revoke org B's token just by guessing an id.
  const orgTokens = await listApiTokensForOrg(resolved.org.id);
  if (!orgTokens.some((t) => t.id === id)) return NextResponse.json({ error: "token not found" }, { status: 404 });

  await deleteApiToken(id);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "token.revoked", targetType: "api_token", targetId: id });

  return NextResponse.json({ ok: true });
});
