import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getOrgForMember, latestScanSummary, listApiTokensForOrg, listOrgMembers, listPendingOrgInvites, listReposForOrg, orgFindingCounts } from "@/lib/db/queries";
import type { Severity } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { AppNavBar } from "@/components/account-menu";
import { InvitesCard } from "./invites-card";
import { MembersCard } from "./members-card";
import { RepoCreateForm } from "./repo-create-form";
import { SlackSettingsCard } from "./slack-settings-card";
import { TokensCard } from "./tokens-card";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

export default async function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) notFound();

  const [repos, members, tokens, findingCounts, invites] = await Promise.all([
    listReposForOrg(resolved.org.id),
    listOrgMembers(resolved.org.id),
    listApiTokensForOrg(resolved.org.id),
    orgFindingCounts(resolved.org.id),
    resolved.membership.role === "owner" ? listPendingOrgInvites(resolved.org.id) : Promise.resolve([]),
  ]);

  const summaries = await Promise.all(repos.map((repo) => latestScanSummary(repo.id)));
  const isOwner = resolved.membership.role === "owner";
  const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
  const countBySeverity = Object.fromEntries(findingCounts.map((row) => [row.severity, row.count])) as Partial<Record<Severity, number>>;
  const totalOpen = findingCounts.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <AppNavBar />
      <main className="container-page flex flex-col gap-8 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-steel-50">{resolved.org.name}</h1>
        <Link href={`/app/${slug}/activity`} className="text-sm text-steel-400 hover:text-cobalt-400">
          Activity →
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open findings across all repos</CardTitle>
        </CardHeader>
        <CardContent>
          {totalOpen === 0 ? (
            <p className="text-sm text-mint-400">Nothing open right now.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {SEVERITY_ORDER.filter((severity) => (countBySeverity[severity] ?? 0) > 0).map((severity) => (
                <Badge key={severity} tone={severity}>
                  {countBySeverity[severity]} {severity}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repos</CardTitle>
          <CardDescription>Each repo tracks its own scan history and open findings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {repos.length === 0 ? (
            <p className="text-sm text-steel-500">No repos yet - add one, or run `warden scan --upload` against a new repo slug to create it automatically.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {repos.map((repo, i) => {
                const scan = summaries[i];
                return (
                  <li key={repo.id} className="flex items-center justify-between gap-3 rounded-lg border border-steel-800 p-3 text-sm">
                    <Link href={`/app/${slug}/${repo.slug}`} className="text-steel-100 hover:text-cobalt-400">
                      {repo.name}
                    </Link>
                    {scan ? (
                      <div className="flex items-center gap-2">
                        {scan.criticalCount > 0 ? <Badge tone="critical">{scan.criticalCount} critical</Badge> : null}
                        {scan.highCount > 0 ? <Badge tone="high">{scan.highCount} high</Badge> : null}
                        {scan.criticalCount === 0 && scan.highCount === 0 ? <Badge tone="safe">clean</Badge> : null}
                        <span className="text-xs text-steel-500">{formatRelativeTime(scan.startedAt)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-steel-500">no scans yet</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <RepoCreateForm slug={slug} />
        </CardContent>
      </Card>

      <MembersCard slug={slug} members={members} isOwner={isOwner} />
      {isOwner ? (
        <InvitesCard slug={slug} invites={invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))} />
      ) : null}
      <TokensCard slug={slug} tokens={tokens.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), lastUsedAt: t.lastUsedAt?.toISOString() ?? null }))} isOwner={isOwner} />
      {isOwner ? <SlackSettingsCard slug={slug} connected={!!resolved.org.slackWebhookUrl} /> : null}
      </main>
    </>
  );
}
