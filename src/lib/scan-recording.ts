import { completeScan, createScan, getOrgById, insertFindings, logAudit } from "@/lib/db/queries";
import type { Repo, ScanSource, Severity } from "@/lib/db/schema";
import { formatBlockedScanMessage, sendSlackNotification } from "@/lib/notify/slack";
import { meetsThreshold } from "@/lib/severity";

export interface RecordableFinding {
  ruleId: string;
  severity: Severity;
  filePath: string;
  line: number;
  column: number | null;
  message: string;
  snippet: string;
  fixSuggestion: string | null;
}

export interface RecordScanInput {
  orgId: number;
  repo: Repo;
  source: ScanSource;
  findings: RecordableFinding[];
  filesScanned: number;
  commitSha?: string | null;
  branch?: string | null;
  triggeredByTokenId?: number | null;
  triggeredByUserId?: number | null;
}

export interface RecordScanResult {
  scanId: number;
  blocked: boolean;
  counts: Record<Severity, number>;
}

/**
 * The single path every scan result flows through, regardless of where
 * it came from (a CLI --upload, a GitHub webhook triggering a
 * server-side clone-and-scan) - filter out ignored rules, insert
 * findings, roll up counts, decide blocked against the repo's own
 * threshold, audit-log it, and notify Slack if configured. Two
 * independent ingestion routes calling this instead of duplicating the
 * logic means the CI-gate and notification behavior can never quietly
 * drift apart between them.
 *
 * ignoredRuleIds is applied here, server-side, rather than just hidden
 * in the dashboard afterward - an ignored rule's findings are never
 * inserted at all, so they can't silently push a scan over its fail
 * threshold or trigger a Slack notification either.
 */
export async function recordScan(input: RecordScanInput): Promise<RecordScanResult> {
  const ignored = new Set(input.repo.ignoredRuleIds);
  const findings = ignored.size === 0 ? input.findings : input.findings.filter((f) => !ignored.has(f.ruleId));

  const startedAt = Date.now();
  const scan = await createScan({
    repoId: input.repo.id,
    triggeredByTokenId: input.triggeredByTokenId ?? null,
    triggeredByUserId: input.triggeredByUserId ?? null,
    source: input.source,
    commitSha: input.commitSha ?? null,
    branch: input.branch ?? null,
  });

  await insertFindings(scan.id, findings);

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;

  await completeScan(scan.id, {
    status: "completed",
    filesScanned: input.filesScanned,
    counts,
    durationMs: Date.now() - startedAt,
  });

  await logAudit({
    orgId: input.orgId,
    actorUserId: input.triggeredByUserId ?? null,
    action: "scan.completed",
    targetType: "scan",
    targetId: scan.id,
    metadata: { repoSlug: input.repo.slug, source: input.source, counts, viaTokenId: input.triggeredByTokenId ?? null },
  });

  const blocked = meetsThreshold(counts, input.repo.failThreshold);

  if (blocked) {
    const org = await getOrgById(input.orgId);
    if (org?.slackWebhookUrl) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3522";
      await sendSlackNotification(
        org.slackWebhookUrl,
        formatBlockedScanMessage({
          orgName: org.name,
          repoName: input.repo.name,
          scanId: scan.id,
          counts,
          dashboardUrl: `${appUrl}/app/${org.slug}/${input.repo.slug}/scans/${scan.id}`,
        })
      );
    }
  }

  return { scanId: scan.id, blocked, counts };
}
