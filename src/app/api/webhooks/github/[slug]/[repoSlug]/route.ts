import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-error-handler";
import { getOrgBySlug, getRepoBySlug } from "@/lib/db/queries";
import { rateLimit } from "@/lib/rate-limit";
import { recordScan } from "@/lib/scan-recording";
import { branchNameFromRef, cloneAndScan } from "@/lib/webhooks/clone-and-scan";
import { verifyGitHubSignature } from "@/lib/webhooks/github-verify";

export const runtime = "nodejs";

const pushPayloadSchema = z.object({
  ref: z.string(),
  after: z.string(),
});

/**
 * Push-triggered, server-side scanning - no CI runner or CLI needed on
 * the consumer's side at all. Authenticated entirely by the HMAC
 * signature (there's no session here, and there can't be: GitHub is the
 * caller), so every failure path returns a generic 404/401 rather than
 * distinguishing "org doesn't exist" from "repo doesn't exist" from
 * "webhook not configured" - none of that should be inferable from the
 * response by someone probing URLs without the real secret.
 */
export const POST = withErrorHandling(async (request: Request, { params }: { params: Promise<{ slug: string; repoSlug: string }> }) => {
  const { slug, repoSlug } = await params;

  const org = await getOrgBySlug(slug);
  const repo = org ? await getRepoBySlug(org.id, repoSlug) : null;
  if (!org || !repo || !repo.githubWebhookSecret || !repo.githubCloneUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const limit = rateLimit(`github-webhook:${repo.id}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  // Read as raw text and verify BEFORE any JSON.parse - signature
  // verification has to run against the exact bytes GitHub signed.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubSignature(rawBody, signature, repo.githubWebhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const eventType = request.headers.get("x-github-event");
  if (eventType === "ping") {
    // Sent once when the webhook is first configured, to let the owner
    // confirm delivery works - not a push, nothing to scan.
    return NextResponse.json({ ok: true });
  }
  if (eventType !== "push") {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  const json = JSON.parse(rawBody);
  const parsed = pushPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid push payload" }, { status: 400 });
  }
  const branch = branchNameFromRef(parsed.data.ref);

  let cloneResult;
  try {
    cloneResult = await cloneAndScan(repo.githubCloneUrl, branch);
  } catch (err) {
    console.error(`clone-and-scan failed for repo ${repo.id}:`, err);
    return NextResponse.json({ error: "failed to clone and scan the repository" }, { status: 502 });
  }

  const findings = cloneResult.results.flatMap((r) => r.findings.map((f) => ({ ...f, filePath: r.filePath })));
  const result = await recordScan({
    orgId: org.id,
    repo,
    source: "ci",
    filesScanned: cloneResult.filesScanned,
    commitSha: parsed.data.after,
    branch,
    findings,
  });

  return NextResponse.json(result, { status: 201 });
});
