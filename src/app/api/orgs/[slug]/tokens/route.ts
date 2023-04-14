import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiToken, getOrgForMember, listApiTokensForOrg, logAudit } from "@/lib/db/queries";
import { getSession } from "@/lib/auth/session";
import { generateApiToken } from "@/lib/auth/token";
import { rateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const CREATE_TOKEN_RATE_LIMIT = 20;
const CREATE_TOKEN_RATE_WINDOW_MS = 60 * 60_000;

export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  const tokens = await listApiTokensForOrg(resolved.org.id);
  return NextResponse.json({ tokens });
});

const bodySchema = z.object({
  label: z.string().trim().min(1).max(100),
  // Opt-in - omitted or null means the token never expires, same as
  // every token created before this field existed.
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});

// Owner-only, same as every other credential-issuing action - a token
// scopes to the whole org's repos, so a plain member minting one would be
// a privilege-escalation path (upload scans as if they were CI, with no
// further check on what repo they claim).
export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug } = await params;
  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) return NextResponse.json({ error: "org not found" }, { status: 404 });

  if (resolved.membership.role !== "owner") {
    return NextResponse.json({ error: "only an org owner can create API tokens" }, { status: 403 });
  }

  const limitResult = rateLimit(`create-token:${session.userId}`, CREATE_TOKEN_RATE_LIMIT, CREATE_TOKEN_RATE_WINDOW_MS);
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

  const expiresAt = parsed.data.expiresInDays ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000) : null;

  const { raw: rawToken, hash } = generateApiToken();
  const token = await createApiToken(resolved.org.id, hash, parsed.data.label, session.userId, expiresAt);
  await logAudit({ orgId: resolved.org.id, actorUserId: session.userId, action: "token.created", targetType: "api_token", targetId: token.id });

  // The only point in this token's life the raw value is ever returned -
  // only the hash is stored, so this response is the caller's one chance
  // to copy it down.
  return NextResponse.json(
    { token: { id: token.id, label: token.label, createdAt: token.createdAt, expiresAt: token.expiresAt, raw: rawToken } },
    { status: 201 }
  );
});
