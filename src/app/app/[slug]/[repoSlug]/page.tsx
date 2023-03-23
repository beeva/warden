import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { countScansForRepo, getOrgForMember, getRepoBySlug, listScansForRepo, listWebhookDeliveriesForRepo } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { DangerZoneCard } from "./danger-zone-card";
import { GithubSettingsCard } from "./github-settings-card";
import { IgnoredRulesCard } from "./ignored-rules-card";
import { RepoSettingsCard } from "./repo-settings-card";
import { WebhookDeliveriesCard } from "./webhook-deliveries-card";

const PAGE_SIZE = 20;

export async function generateMetadata({ params }: { params: Promise<{ slug: string; repoSlug: string }> }) {
  const { repoSlug } = await params;
  return { title: repoSlug };
}

export default async function RepoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; repoSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug, repoSlug } = await params;
  const page = parsePage((await searchParams).page);
  const session = await getSession();
  if (!session) redirect("/login");

  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) notFound();

  const repo = await getRepoBySlug(resolved.org.id, repoSlug);
  if (!repo) notFound();

  const [scans, totalScans, deliveries] = await Promise.all([
    listScansForRepo(repo.id, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    countScansForRepo(repo.id),
    repo.githubWebhookSecret ? listWebhookDeliveriesForRepo(repo.id, 20) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalScans / PAGE_SIZE));

  return (
    <main className="container-page flex flex-col gap-8 py-16">
      <div>
        <Link href={`/app/${slug}`} className="text-sm text-steel-400 hover:text-cobalt-400">
          ← {resolved.org.name}
        </Link>
        <h1 className="mt-1 font-display text-2xl text-steel-50">{repo.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scans</CardTitle>
            {scans.length > 1 ? (
              <Link href={`/app/${slug}/${repoSlug}/compare`} className="text-sm text-steel-400 hover:text-cobalt-400">
                Compare scans →
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <p className="text-sm text-steel-500">
              No scans yet. Run <code className="text-steel-300">warden scan --upload --repo {repo.slug}</code> against this repo, or trigger one from CI.
            </p>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-steel-500">
                    <th className="pb-2 pr-4 font-medium">Started</th>
                    <th className="pb-2 pr-4 font-medium">Source</th>
                    <th className="pb-2 pr-4 font-medium">Branch</th>
                    <th className="pb-2 pr-4 font-medium">Findings</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id} className="border-t border-steel-800 text-steel-200">
                      <td className="py-2 pr-4">
                        <Link href={`/app/${slug}/${repoSlug}/scans/${scan.id}`} className="hover:text-cobalt-400">
                          {formatRelativeTime(scan.startedAt)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-xs uppercase text-steel-400">{scan.source}</td>
                      <td className="py-2 pr-4 text-xs text-steel-400">{scan.branch ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-1.5">
                          {scan.criticalCount > 0 ? <Badge tone="critical">{scan.criticalCount}</Badge> : null}
                          {scan.highCount > 0 ? <Badge tone="high">{scan.highCount}</Badge> : null}
                          {scan.mediumCount > 0 ? <Badge tone="medium">{scan.mediumCount}</Badge> : null}
                          {scan.criticalCount === 0 && scan.highCount === 0 && scan.mediumCount === 0 ? <Badge tone="safe">clean</Badge> : null}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={scan.status === "completed" ? "safe" : scan.status === "failed" ? "critical" : "neutral"}>{scan.status}</Badge>
                      </td>
                      <td className="py-2 text-xs text-steel-400">{scan.durationMs != null ? formatDuration(scan.durationMs) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination basePath={`/app/${slug}/${repoSlug}`} page={page} totalPages={totalPages} />
        </CardContent>
      </Card>

      {resolved.membership.role === "owner" ? <WebhookDeliveriesCard slug={slug} repoSlug={repoSlug} deliveries={deliveries} /> : null}

      {resolved.membership.role === "owner" ? (
        <>
          <RepoSettingsCard slug={slug} repoSlug={repoSlug} failThreshold={repo.failThreshold} />
          <IgnoredRulesCard slug={slug} repoSlug={repoSlug} ignoredRuleIds={repo.ignoredRuleIds} />
          <GithubSettingsCard slug={slug} repoSlug={repoSlug} connected={!!repo.githubWebhookSecret} />
          <DangerZoneCard slug={slug} repoSlug={repoSlug} />
        </>
      ) : null}
    </main>
  );
}
