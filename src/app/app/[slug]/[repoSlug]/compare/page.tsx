import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getOrgForMember, getRepoBySlug, getScanById, listAllFindingsForScan, listScansForRepo } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { partitionFindings } from "@/lib/scan-diff";
import type { Severity } from "@/lib/db/schema";

export const metadata = { title: "Compare scans" };

const SEVERITY_TONE: Record<Severity, "critical" | "high" | "medium" | "low" | "info"> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
};

export default async function CompareScansPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; repoSlug: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { slug, repoSlug } = await params;
  const { from, to } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) notFound();

  const repo = await getRepoBySlug(resolved.org.id, repoSlug);
  if (!repo) notFound();

  const scans = await listScansForRepo(repo.id, 100, 0);

  const fromId = Number(from);
  const toId = Number(to);
  const bothValid = Number.isInteger(fromId) && Number.isInteger(toId) && fromId !== toId;

  const [fromScan, toScan] = bothValid
    ? await Promise.all([getScanById(fromId), getScanById(toId)])
    : [null, null];
  const scansValid = fromScan && toScan && fromScan.repoId === repo.id && toScan.repoId === repo.id;

  const partition = scansValid
    ? partitionFindings(await listAllFindingsForScan(fromScan.id), await listAllFindingsForScan(toScan.id))
    : null;

  return (
    <main className="container-page flex flex-col gap-8 py-16">
      <div>
        <Link href={`/app/${slug}/${repoSlug}`} className="text-sm text-steel-400 hover:text-cobalt-400">
          ← {repo.name}
        </Link>
        <h1 className="mt-1 font-display text-2xl text-steel-50">Compare scans</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pick two scans</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-steel-300" htmlFor="from">
                From (older)
              </label>
              <select
                id="from"
                name="from"
                defaultValue={from}
                className="rounded-md border border-steel-700 bg-steel-900 px-3 py-1.5 text-sm text-steel-200"
              >
                {scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    #{scan.id} · {formatDate(scan.startedAt)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-steel-300" htmlFor="to">
                To (newer)
              </label>
              <select
                id="to"
                name="to"
                defaultValue={to}
                className="rounded-md border border-steel-700 bg-steel-900 px-3 py-1.5 text-sm text-steel-200"
              >
                {scans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    #{scan.id} · {formatDate(scan.startedAt)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline">
              Compare
            </Button>
          </form>
        </CardContent>
      </Card>

      {bothValid && !scansValid ? (
        <Card>
          <CardContent className="py-6 text-sm text-crimson-400">One or both of those scans don&apos;t belong to this repo.</CardContent>
        </Card>
      ) : null}

      {partition ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {partition.added.length} new since scan #{fromScan?.id}
              </CardTitle>
              <CardDescription>Present in #{toScan?.id} but not in #{fromScan?.id}, matched by rule + file + line.</CardDescription>
            </CardHeader>
            <CardContent>
              {partition.added.length === 0 ? (
                <p className="text-sm text-steel-500">None.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {partition.added.map((finding) => (
                    <li key={`${finding.ruleId}-${finding.filePath}-${finding.line}`} className="flex items-center gap-2 text-sm">
                      <Badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Badge>
                      <span className="font-mono text-xs text-steel-400">
                        {finding.filePath}:{finding.line}
                      </span>
                      <span className="text-steel-300">{finding.ruleId}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{partition.resolved.length} resolved</CardTitle>
              <CardDescription>Present in #{fromScan?.id} but no longer in #{toScan?.id}.</CardDescription>
            </CardHeader>
            <CardContent>
              {partition.resolved.length === 0 ? (
                <p className="text-sm text-steel-500">None.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {partition.resolved.map((finding) => (
                    <li key={`${finding.ruleId}-${finding.filePath}-${finding.line}`} className="flex items-center gap-2 text-sm">
                      <Badge tone="safe">fixed</Badge>
                      <span className="font-mono text-xs text-steel-400">
                        {finding.filePath}:{finding.line}
                      </span>
                      <span className="text-steel-300">{finding.ruleId}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-steel-500">{partition.unchanged.length} finding(s) unchanged between the two scans.</p>
        </>
      ) : null}
    </main>
  );
}
