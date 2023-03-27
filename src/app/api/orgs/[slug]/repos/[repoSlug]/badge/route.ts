import { NextResponse } from "next/server";
import { getOrgBySlug, getRepoBySlug, latestScanSummary } from "@/lib/db/queries";
import { renderBadgeSvg } from "@/lib/badge-svg";
import { meetsThreshold } from "@/lib/severity";
import type { Severity } from "@/lib/db/schema";
import { withErrorHandling } from "@/lib/api-error-handler";

export const runtime = "nodejs";

const LABEL = "security scan";
const COLOR_PASSING = "#2fc394"; // mint-500
const COLOR_FAILING = "#f0495c"; // crimson-500
const COLOR_UNKNOWN = "#717a8f"; // steel-500

/**
 * A shields.io-style status badge, meant to be embedded directly in a
 * repo's README (`![warden](.../badge)`) - public and unauthenticated on
 * purpose, the same convention CI badges use everywhere, since a
 * README-embedded image can't carry a session cookie or a bearer token
 * anyway. It reports pass/fail against the repo's own configured
 * failThreshold, not a hardcoded "any critical" - the same rule the
 * actual CI gate uses, so the badge can't say "passing" while a real
 * webhook/CLI upload would have reported blocked: true.
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ slug: string; repoSlug: string }> }) => {
  const { slug, repoSlug } = await params;

  const org = await getOrgBySlug(slug);
  const repo = org ? await getRepoBySlug(org.id, repoSlug) : null;

  const svg = await (async () => {
    if (!repo) return renderBadgeSvg(LABEL, "unknown", COLOR_UNKNOWN);

    const scan = await latestScanSummary(repo.id);
    if (!scan) return renderBadgeSvg(LABEL, "no scans yet", COLOR_UNKNOWN);

    const counts: Record<Severity, number> = {
      critical: scan.criticalCount,
      high: scan.highCount,
      medium: scan.mediumCount,
      low: scan.lowCount,
      info: scan.infoCount,
    };
    const failing = meetsThreshold(counts, repo.failThreshold);
    return renderBadgeSvg(LABEL, failing ? "failing" : "passing", failing ? COLOR_FAILING : COLOR_PASSING);
  })();

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // A badge that never updates defeats the point - short-lived
      // caching balances that against not hitting Postgres on every
      // single README render across every viewer of a popular repo.
      "cache-control": "public, max-age=60, s-maxage=60",
    },
  });
});
