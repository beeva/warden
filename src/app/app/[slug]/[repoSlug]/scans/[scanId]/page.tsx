import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import {
  countFindingsForScan,
  getOrgForMember,
  getPreviousScan,
  getRepoBySlug,
  getScanById,
  listFindingKeysForScan,
  listFindingsForScan,
} from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";
import { diffScans } from "@/lib/scan-diff";
import type { Severity } from "@/lib/db/schema";
import { FindingStatusControl } from "./finding-status-control";

const SEVERITY_TONE: Record<Severity, "critical" | "high" | "medium" | "low" | "info"> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
};

const PAGE_SIZE = 50;

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; repoSlug: string; scanId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug, repoSlug, scanId } = await params;
  const page = parsePage((await searchParams).page);
  const session = await getSession();
  if (!session) redirect("/login");

  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) notFound();

  const repo = await getRepoBySlug(resolved.org.id, repoSlug);
  if (!repo) notFound();

  const id = Number(scanId);
  const scan = Number.isInteger(id) ? await getScanById(id) : null;
  if (!scan || scan.repoId !== repo.id) notFound();

  const [findings, totalFindings, previousScan] = await Promise.all([
    listFindingsForScan(scan.id, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    countFindingsForScan(scan.id),
    getPreviousScan(repo.id, scan.startedAt),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalFindings / PAGE_SIZE));

  const diff = previousScan
    ? diffScans(await listFindingKeysForScan(previousScan.id), await listFindingKeysForScan(scan.id))
    : null;

  return (
    <main className="container-page flex flex-col gap-8 py-16">
      <div>
        <Link href={`/app/${slug}/${repoSlug}`} className="text-sm text-steel-400 hover:text-cobalt-400">
          ← {repo.name}
        </Link>
        <h1 className="mt-1 font-display text-2xl text-steel-50">Scan #{scan.id}</h1>
        <p className="mt-1 text-sm text-steel-400">
          {scan.source.toUpperCase()} · {scan.branch ?? "no branch"} · {scan.commitSha ? scan.commitSha.slice(0, 12) : "no commit"} · {formatDate(scan.startedAt)}
        </p>
        {diff && previousScan ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-steel-500">
            <span>
              Since{" "}
              <Link href={`/app/${slug}/${repoSlug}/scans/${previousScan.id}`} className="text-steel-300 hover:text-cobalt-400">
                scan #{previousScan.id}
              </Link>
              :
            </span>
            {diff.newCount > 0 ? <Badge tone="critical">{diff.newCount} new</Badge> : null}
            {diff.resolvedCount > 0 ? <Badge tone="safe">{diff.resolvedCount} resolved</Badge> : null}
            {diff.newCount === 0 && diff.resolvedCount === 0 ? <span>no change</span> : null}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Findings ({totalFindings})</CardTitle>
            {totalFindings > 0 ? (
              <a href={`/api/orgs/${slug}/scans/${scan.id}/export`} className="text-xs text-cobalt-400 hover:text-cobalt-300">
                Export CSV
              </a>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <p className="text-sm text-mint-400">No findings in this scan.</p>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-steel-500">
                    <th className="pb-2 pr-4 font-medium">Severity</th>
                    <th className="pb-2 pr-4 font-medium">Location</th>
                    <th className="pb-2 pr-4 font-medium">Finding</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((finding) => (
                    <tr key={finding.id} className="border-t border-steel-800 align-top text-steel-200">
                      <td className="py-3 pr-4">
                        <Badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-steel-400">
                        {finding.filePath}:{finding.line}
                      </td>
                      <td className="py-3 pr-4">
                        <p>{finding.message}</p>
                        <p className="mt-1 text-xs text-steel-500">{finding.ruleId}</p>
                        {finding.fixSuggestion ? <p className="mt-1 text-xs text-cobalt-400">{finding.fixSuggestion}</p> : null}
                      </td>
                      <td className="py-3">
                        <FindingStatusControl slug={slug} findingId={finding.id} status={finding.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination basePath={`/app/${slug}/${repoSlug}/scans/${scan.id}`} page={page} totalPages={totalPages} />
        </CardContent>
      </Card>
    </main>
  );
}
