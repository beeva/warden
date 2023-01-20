import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-error-handler";
import { hashApiToken } from "@/lib/auth/token";
import {
  completeScan,
  createRepo,
  createScan,
  getApiTokenByHash,
  getRepoBySlug,
  insertFindings,
  logAudit,
  touchApiTokenLastUsed,
} from "@/lib/db/queries";
import type { Severity } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";

const findingSchema = z.object({
  filePath: z.string().min(1),
  ruleId: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative().nullable(),
  message: z.string().min(1),
  snippet: z.string(),
  fixSuggestion: z.string().nullable(),
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

const BLOCKING_SEVERITIES = new Set<Severity>(["critical"]);

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

  const startedAt = Date.now();
  const scan = await createScan({
    repoId: repo.id,
    triggeredByTokenId: token.id,
    source: body.source,
    commitSha: body.commitSha ?? null,
    branch: body.branch ?? null,
  });

  await insertFindings(
    scan.id,
    body.findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      filePath: f.filePath,
      line: f.line,
      column: f.column,
      message: f.message,
      snippet: f.snippet,
      fixSuggestion: f.fixSuggestion,
    }))
  );

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of body.findings) counts[f.severity] += 1;

  await completeScan(scan.id, {
    status: "completed",
    filesScanned: body.filesScanned,
    counts,
    durationMs: Date.now() - startedAt,
  });

  await logAudit({
    orgId: token.orgId,
    actorUserId: null,
    action: "scan.completed",
    targetType: "scan",
    targetId: scan.id,
    metadata: { repoSlug: body.repoSlug, source: body.source, counts, viaTokenId: token.id },
  });

  const blocked = (Object.keys(counts) as Severity[]).some((s) => counts[s] > 0 && BLOCKING_SEVERITIES.has(s));

  return NextResponse.json({ scanId: scan.id, blocked, counts }, { status: 201 });
});
