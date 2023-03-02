import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getOrgForMember, listAuditLogForOrg } from "@/lib/db/queries";
import { AppNavBar } from "@/components/account-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import { formatAction, formatDetail } from "./format-action";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const resolved = await getOrgForMember(slug, session.userId);
  if (!resolved) notFound();

  const entries = await listAuditLogForOrg(resolved.org.id, 100);

  return (
    <>
      <AppNavBar />
      <main className="container-page flex flex-col gap-8 py-16">
        <div>
          <Link href={`/app/${slug}`} className="text-sm text-steel-400 hover:text-cobalt-400">
            ← {resolved.org.name}
          </Link>
          <h1 className="mt-1 font-display text-2xl text-steel-50">Activity</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-sm text-steel-500">Nothing yet - every scan, repo change, and membership change will show up here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {entries.map((entry) => {
                  const detail = formatDetail(entry.action, entry.metadata);
                  return (
                    <li key={entry.id} className="flex items-start justify-between gap-3 border-t border-steel-800 py-2 text-sm first:border-t-0">
                      <div>
                        <span className="text-steel-200">{entry.actorEmail ?? "via API"}</span>{" "}
                        <span className="text-steel-400">{formatAction(entry.action)}</span>
                        {detail ? <span className="ml-2 text-xs text-steel-500">({detail})</span> : null}
                      </div>
                      <span className="shrink-0 text-xs text-steel-500">{formatRelativeTime(entry.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
