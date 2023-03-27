import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Docs" };

function Code({ children }: { children: string }) {
  return <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-steel-900 p-4 font-mono text-xs text-steel-200">{children}</pre>;
}

export default function DocsPage() {
  return (
    <>
      <SiteHeader />
      <main className="container-page flex flex-col gap-8 py-16">
        <div>
          <h1 className="font-display text-3xl text-steel-50">Docs</h1>
          <p className="text-steel-400">Scan locally, wire it into CI, and see the results in the dashboard.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Scan locally</CardTitle>
            <CardDescription>No account needed - the CLI works standalone against any .sol file or directory.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`npx warden scan ./contracts

# tmp-fixture/Vulnerable.sol
#   CRITICAL 9:19  External call on line 9 is followed by a state write on line 11...
#   HIGH     19:12 tx.origin is compared here...
#
# 4 findings across 1 file (2 critical, 1 high, 1 info)
# exit code 1 - a critical finding was found`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Create an org and a token</CardTitle>
            <CardDescription>Public and rate-limited - signup also sets your session cookie. Tokens are owner-only.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`curl -X POST https://your-warden-host/api/auth/signup \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{"email":"you@example.com","password":"correcthorsebattery","orgName":"Acme Labs"}'

curl -X POST https://your-warden-host/api/orgs/acme-labs/tokens \\
  -b cookies.txt \\
  -H "Content-Type: application/json" \\
  -d '{"label":"ci-github-actions"}'

# {"token": {"id": 1, "label": "ci-github-actions", "raw": "wdn_..."}}
# The raw value is shown exactly once - only its SHA-256 hash is stored.`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Upload results from the CLI</CardTitle>
            <CardDescription>Creates the repo automatically on first upload if it doesn&apos;t exist yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`npx warden scan ./contracts \\
  --upload --repo my-protocol --token $WARDEN_TOKEN \\
  --commit $(git rev-parse HEAD) --branch main

# uploaded as scan #14 - dashboard marks this blocked`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Or use the GitHub Action</CardTitle>
            <CardDescription>See action.yml in the repo root - a composite action wrapping the same CLI.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`- uses: your-org/warden@v1
  with:
    path: ./contracts
    fail-on: critical
    repo: my-protocol
    token: \${{ secrets.WARDEN_TOKEN }}`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Add a status badge</CardTitle>
            <CardDescription>Public and unauthenticated, like any CI badge - reflects the repo&apos;s own fail-threshold, updated within 60 seconds of the latest scan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`![Warden](https://your-warden-host/api/orgs/acme-labs/repos/my-protocol/badge)`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate limits</CardTitle>
            <CardDescription>Per-IP, per-user, or per-token, in-process.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-steel-500">
                    <th className="pb-2 pr-4 font-medium">Endpoint</th>
                    <th className="pb-2 pr-4 font-medium">Limit</th>
                    <th className="pb-2 font-medium">Keyed by</th>
                  </tr>
                </thead>
                <tbody className="text-steel-300">
                  <tr className="border-t border-steel-800">
                    <td className="py-2 pr-4 font-mono text-xs">POST /api/auth/signup</td>
                    <td className="py-2 pr-4">10 / hour</td>
                    <td className="py-2">IP</td>
                  </tr>
                  <tr className="border-t border-steel-800">
                    <td className="py-2 pr-4 font-mono text-xs">POST /api/auth/login</td>
                    <td className="py-2 pr-4">10 / 5 minutes</td>
                    <td className="py-2">IP</td>
                  </tr>
                  <tr className="border-t border-steel-800">
                    <td className="py-2 pr-4 font-mono text-xs">POST /api/v1/scans</td>
                    <td className="py-2 pr-4">30 / hour</td>
                    <td className="py-2">API token</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
