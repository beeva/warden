import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { detectorRegistry } from "@/lib/detectors/registry";

export const metadata = { title: "Rules" };

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

// Generated from the same detectorRegistry the scan engine actually
// runs, not a hand-maintained list kept in sync by hand - so this page
// can never drift out of date with what Warden actually checks for.
export default function RulesPage() {
  const bySeverity = SEVERITY_ORDER.map((severity) => ({
    severity,
    detectors: detectorRegistry.filter((d) => d.severity === severity),
  })).filter((group) => group.detectors.length > 0);

  return (
    <>
      <SiteHeader />
      <main className="container-page flex flex-col gap-8 py-16">
        <div>
          <h1 className="font-display text-3xl text-steel-50">Rules</h1>
          <p className="text-steel-400">
            Every detector Warden runs, generated from the registry - {detectorRegistry.length} in total.
          </p>
        </div>

        {bySeverity.map((group) => (
          <div key={group.severity} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={group.severity}>{group.severity}</Badge>
              <span className="text-sm text-steel-500">
                {group.detectors.length} rule{group.detectors.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.detectors.map((detector) => (
                <Card key={detector.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{detector.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-steel-400">{detector.description}</p>
                    <code className="text-xs text-steel-500">{detector.id}</code>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
