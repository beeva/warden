import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="container-page flex flex-col gap-16 py-24">
        <div className="flex flex-col items-start gap-6">
          <h1 className="font-display text-4xl text-steel-50 sm:text-5xl">
            Every contract, <span className="text-gradient">adversarially reviewed</span>
          </h1>
          <p className="max-w-2xl text-lg text-steel-400">
            Static analysis that models the exploit classes that actually recur on-chain - reentrancy, tx.origin
            auth, unprotected selfdestruct, and more - and runs on every commit, not once a quarter. Real AST
            parsing, no paid API, findings you can act on in the CLI, CI, or the dashboard.
          </p>
          <LinkButton href="/login" size="lg">
            Sign in
          </LinkButton>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Real static analysis</CardTitle>
              <CardDescription>A real Solidity AST, not regex - detectors reason about control flow, not text patterns.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Runs on every commit</CardTitle>
              <CardDescription>CLI locally, GitHub Action in CI - a security review that&apos;s part of the pipeline, not a launch-day scramble.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Validated against a corpus</CardTitle>
              <CardDescription>Every detector is checked against real vulnerable and safe fixture contracts, not just happy-path samples.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </>
  );
}
