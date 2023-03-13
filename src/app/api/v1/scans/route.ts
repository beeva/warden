import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-error-handler";
import { hashApiToken } from "@/lib/auth/token";
import { createRepo, getApiTokenByHash, getRepoBySlug, touchApiTokenLastUsed } from "@/lib/db/queries";
import { rateLimit } from "@/lib/rate-limit";
import { recordScan } from "@/lib/scan-recording";

// Every string field is capped - request.json() buffers the whole body
// into memory before Zod ever runs, so with no bound here a single
// request (5000 findings x unbounded strings) from one leaked token
// could OOM the process well before the per-token rate limit engages.
// Sizes are set generously above what a real detector finding needs.
const findingSchema = z.object({
  filePath: z.string().min(1).max(500),
  ruleId: z.string().min(1).max(200),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative().nullable(),
  message: z.string().min(1).max(2000),
  snippet: z.string().max(5000),
  fixSuggestion: z.string().max(2000).nullable(),
});

const bodySchema = z.object({
  repoSlug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "repoSlug must be lowercase alphanumeric with hyphens"),
  commitSha: z.string().max(64).optional(),
  branch: z.string().max(200).optional(),
  source: z.enum(["cli", "ci"]).default("ci"),
  filesScanned: z.number().int().nonnegative(),
  findings: z.array(findingSchema).max(5000),
});

async function authenticate(request: NextRequest) {
  const header = request.headers.get("authorization");
  const raw = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!raw) return null;

  const token = await getApiTokenByHash(hashApiToken(raw));
  return token;
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const token = await authenticate(request);
  if (!token) {
    return NextResponse.json({ error: "missing or invalid API token" }, { status: 401 });
  }

  // Scoped per-token, not per-IP - a shared CI runner IP shouldn't throttle
  // every org that happens to build on it, but a single token hammering
  // uploads (a misconfigured retry loop) should be capped.
  const limit = rateLimit(`scan-upload:${token.id}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate limit exceeded, try again later" }, { status: 429 });
  }

  // Checked before request.json() ever buffers the body into memory -
  // the per-field string caps below only apply after JSON.parse has
  // already paid the cost of loading (and allocating) the whole thing.
  // 5000 findings x the schema's own max string lengths comes out to
  // roughly 5-6MB; 10MB leaves headroom without allowing an arbitrarily
  // large body through.
  const MAX_BODY_BYTES = 10 * 1024 * 1024;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "request body too large" }, { status: 413 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request body", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  await touchApiTokenLastUsed(token.id);

  let repo = await getRepoBySlug(token.orgId, body.repoSlug);
  if (!repo) {
    repo = await createRepo(token.orgId, body.repoSlug, body.repoSlug);
  }

  const result = await recordScan({
    orgId: token.orgId,
    repo,
    source: body.source,
    filesScanned: body.filesScanned,
    commitSha: body.commitSha,
    branch: body.branch,
    triggeredByTokenId: token.id,
    findings: body.findings,
  });

  return NextResponse.json(result, { status: 201 });
});
