import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { getOrgBySlug, getRepoBySlug, recordWebhookDelivery } from "@/lib/db/queries";
import { rateLimit } from "@/lib/rate-limit";
import { recordScan } from "@/lib/scan-recording";
import { cloneAndScan } from "@/lib/webhooks/clone-and-scan";
import { verifyGitHubSignature } from "@/lib/webhooks/github-verify";
import { resolvePullRequestTarget, resolvePushTarget, type ScanTarget } from "@/lib/webhooks/resolve-target";

export const runtime = "nodejs";

/**
 * Push-triggered, server-side scanning - no CI runner or CLI needed on
 * the consumer's side at all. Handles both `push` (scan whatever landed
 * on a branch) and `pull_request` (scan the PR's head commit on
 * opened/synchronize/reopened - the common "block merge on critical"
 * pattern) - the same clone-and-scan and recordScan path either way,
 * they only differ in which branch/commit they resolve to.
 *
 * Authenticated entirely by the HMAC signature (there's no session here,
 * and there can't be: GitHub is the caller), so every failure path
 * returns a generic 404/401 rather than distinguishing "org doesn't
 * exist" from "repo doesn't exist" from "webhook not configured" - none
 * of that should be inferable from the response by someone probing URLs
 * without the real secret.
 *
 * Every attempt that gets far enough to identify a real repo (valid or
 * not) is recorded in webhook_deliveries - the same "recent deliveries"
 * concept GitHub's own webhook settings show, so an owner debugging "why
 * didn't my push trigger a scan" has somewhere to look besides server
 * logs they don't have access to. A request for an unrecognized
 * org/repo slug isn't recorded anywhere, on purpose - there's no repo id
 * to attach it to, and logging by slug alone would just be a knob for
 * flooding a table with junk from anyone probing random URLs.
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

  const eventType = request.headers.get("x-github-event");

  // Read as raw text and verify BEFORE any JSON.parse - signature
  // verification has to run against the exact bytes GitHub signed.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubSignature(rawBody, signature, repo.githubWebhookSecret)) {
    await recordWebhookDelivery({ repoId: repo.id, eventType, status: "invalid_signature" });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (eventType === "ping") {
    // Sent once when the webhook is first configured, to let the owner
    // confirm delivery works - not a push, nothing to scan.
    await recordWebhookDelivery({ repoId: repo.id, eventType, status: "ok" });
    return NextResponse.json({ ok: true });
  }

  const json = JSON.parse(rawBody);
  let target: ScanTarget | null = null;
  if (eventType === "push") target = resolvePushTarget(json);
  else if (eventType === "pull_request") target = resolvePullRequestTarget(json);

  if (!target) {
    // Covers three cases identically: an event type this webhook doesn't
    // act on at all, a pull_request action that didn't change the head
    // commit (closed/labeled/...), and a malformed payload for an event
    // type it does act on - none of them are errors worth a non-2xx
    // response, since GitHub would just retry a push it already
    // delivered correctly.
    await recordWebhookDelivery({ repoId: repo.id, eventType, status: "ok", errorMessage: "ignored: nothing to scan for this event" });
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  let cloneResult;
  try {
    cloneResult = await cloneAndScan(repo.githubCloneUrl, target.branch);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`clone-and-scan failed for repo ${repo.id}:`, err);
    await recordWebhookDelivery({ repoId: repo.id, eventType, status: "error", errorMessage: message.slice(0, 500) });
    return NextResponse.json({ error: "failed to clone and scan the repository" }, { status: 502 });
  }

  const findings = cloneResult.results.flatMap((r) => r.findings.map((f) => ({ ...f, filePath: r.filePath })));
  const result = await recordScan({
    orgId: org.id,
    repo,
    source: "ci",
    filesScanned: cloneResult.filesScanned,
    commitSha: target.commitSha,
    branch: target.branch,
    findings,
  });

  await recordWebhookDelivery({ repoId: repo.id, eventType, status: "ok", scanId: result.scanId });

  return NextResponse.json(result, { status: 201 });
});
