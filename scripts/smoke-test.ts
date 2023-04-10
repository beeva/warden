import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { orgs, users } from "../src/lib/db/schema";

/**
 * Exercises the whole stack against a real running server and real
 * Postgres - signup, repo creation, token issuance, a real scan upload,
 * and the CI-gate decision it produces - in one repeatable command,
 * rather than the ad-hoc curl sequences this project was actually
 * verified with throughout development. Safe to run against a real dev
 * (or CI) deployment: everything it creates is cleaned up at the end,
 * success or failure, and the org/user are suffixed with a fresh UUID
 * so concurrent runs never collide.
 *
 * Deliberately NOT run as part of `npm test` or the CI workflow's main
 * job - it needs a real server actually listening on API_URL, which
 * neither vitest nor the CI test job itself provides. Meant to be run
 * by hand (or from a deploy pipeline's post-deploy smoke-check step)
 * against a server that's already up.
 */

const API_URL = process.env.WARDEN_API_URL ?? "http://localhost:3522";
const suffix = randomUUID().slice(0, 8);
const EMAIL = `smoke-${suffix}@example.com`;
const PASSWORD = "smoke-test-password-1234";
const ORG_SLUG = `smoke-org-${suffix}`;
const REPO_SLUG = `smoke-repo-${suffix}`;

const VULNERABLE_CONTRACT_FINDING = {
  filePath: "Vulnerable.sol",
  ruleId: "reentrancy-state-change-after-call",
  severity: "critical" as const,
  line: 6,
  column: 5,
  message: "smoke test finding",
  snippet: "msg.sender.call{value: amount}(\"\");",
  fixSuggestion: "Apply checks-effects-interactions.",
};

interface StepResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: StepResult[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

async function main() {
  const cookieJar: string[] = [];
  const fetchWithCookies = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookieJar.length > 0) headers.set("cookie", cookieJar.join("; "));
    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookieJar.push(setCookie.split(";")[0] ?? "");
    return response;
  };

  // 1. Signup
  const signupResponse = await fetchWithCookies("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, orgName: `Smoke Org ${suffix}` }),
  });
  record("signup creates a real account + org", signupResponse.status === 201, `status ${signupResponse.status}`);
  if (!signupResponse.ok) throw new Error("signup failed, aborting smoke test");

  // 2. Create a repo
  const repoResponse = await fetchWithCookies(`/api/orgs/${ORG_SLUG}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: REPO_SLUG }),
  });
  record("repo creation", repoResponse.status === 201, `status ${repoResponse.status}`);

  // 3. Create an API token
  const tokenResponse = await fetchWithCookies(`/api/orgs/${ORG_SLUG}/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: "smoke-test" }),
  });
  const tokenData = (await tokenResponse.json()) as { token?: { raw: string } };
  record("API token issuance returns a raw token", !!tokenData.token?.raw, `status ${tokenResponse.status}`);
  const rawToken = tokenData.token?.raw;
  if (!rawToken) throw new Error("token creation failed, aborting smoke test");

  // 4. Upload a scan with a real critical finding
  const scanResponse = await fetch(`${API_URL}/api/v1/scans`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${rawToken}` },
    body: JSON.stringify({ repoSlug: REPO_SLUG, filesScanned: 1, findings: [VULNERABLE_CONTRACT_FINDING] }),
  });
  const scanData = (await scanResponse.json()) as { scanId?: number; blocked?: boolean; counts?: Record<string, number> };
  record("scan upload is recorded", scanResponse.status === 201 && typeof scanData.scanId === "number", `status ${scanResponse.status}`);
  record("a critical finding correctly reports blocked: true", scanData.blocked === true, `blocked=${scanData.blocked}`);
  record("severity counts match what was uploaded", scanData.counts?.critical === 1, `counts=${JSON.stringify(scanData.counts)}`);

  // 5. Badge reflects the failing state
  const badgeResponse = await fetch(`${API_URL}/api/orgs/${ORG_SLUG}/repos/${REPO_SLUG}/badge`);
  const badgeSvg = await badgeResponse.text();
  record("status badge reports failing", badgeSvg.includes(">failing<"), `fetched ${badgeSvg.length} bytes`);
}

async function cleanup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  try {
    await db.delete(orgs).where(eq(orgs.slug, ORG_SLUG));
    await db.delete(users).where(eq(users.email, EMAIL));
  } finally {
    await client.end();
  }
}

main()
  .catch((err) => {
    record("smoke test aborted early", false, err instanceof Error ? err.message : String(err));
  })
  .finally(async () => {
    await cleanup();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
    if (failed.length > 0) process.exit(1);
  });
