import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listOrgsForUser } from "@/lib/db/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { AppNavBar } from "@/components/account-menu";

export const metadata = { title: "Your orgs" };

export default async function AppHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgs = await listOrgsForUser(session.userId);

  return (
    <>
      <AppNavBar />
      <main className="container-page flex flex-col gap-8 py-16">
        <h1 className="font-display text-2xl text-steel-50">Your orgs</h1>
        {orgs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-steel-400">You&apos;re not a member of any org yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <Card key={org.id}>
                <CardHeader>
                  <CardTitle>{org.name}</CardTitle>
                  <CardDescription>{org.role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <LinkButton href={`/app/${org.slug}`} variant="outline" size="sm">
                    Open
                  </LinkButton>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
