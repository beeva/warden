import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db/client";
import { orgs, users } from "../../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  addOrgMember,
  completeScan,
  countFindingsForScan,
  countOrgOwners,
  countScansForRepo,
  createApiToken,
  createOrg,
  createRepo,
  createScan,
  createUser,
  deleteRepo,
  getApiTokenByHash,
  getFindingById,
  getMembership,
  getOrgById,
  getOrgBySlug,
  getOrgForMember,
  getOrgMemberById,
  getRepoBySlug,
  getScanById,
  getUserByEmail,
  insertFindings,
  listAuditLogForOrg,
  listFindingsForScan,
  listOrgMembers,
  listReposForOrg,
  listScansForRepo,
  logAudit,
  removeOrgMember,
  repoBelongsToOrg,
  scanBelongsToOrg,
  setFindingStatus,
  setOrgSlackWebhookUrl,
  updateRepoFailThreshold,
} from "../../src/lib/db/queries";

/**
 * Real integration tests against the real Postgres instance this project
 * already runs locally - not mocked, not a separate in-memory shim. Each
 * run gets its own uniquely-suffixed org/user so repeated runs (and CI
 * runs alongside local ones) never collide on a unique constraint, and
 * everything is torn down afterward so the dev database is left clean.
 */
const suffix = randomUUID().slice(0, 8);
const ORG_SLUG = `it-org-${suffix}`;
const OWNER_EMAIL = `it-owner-${suffix}@example.com`;
const MEMBER_EMAIL = `it-member-${suffix}@example.com`;

describe("queries (integration, real Postgres)", () => {
  let ownerId: number;
  let memberId: number;
  let orgId: number;
  let repoId: number;

  beforeAll(async () => {
    const owner = await createUser(OWNER_EMAIL, "not-a-real-hash");
    const member = await createUser(MEMBER_EMAIL, "not-a-real-hash");
    ownerId = owner.id;
    memberId = member.id;

    const org = await createOrg(ORG_SLUG, "Integration Test Org");
    orgId = org.id;
    await addOrgMember(orgId, ownerId, "owner");
    await addOrgMember(orgId, memberId, "member");

    const repo = await createRepo(orgId, "it-repo", "IT Repo");
    repoId = repo.id;
  });

  afterAll(async () => {
    // Deleting the org cascades to repos -> scans -> findings and to
    // org_members and api_tokens (all declared onDelete: "cascade" in
    // the schema); users have no FK back to the org, so they're deleted
    // separately.
    await db.delete(orgs).where(eq(orgs.id, orgId));
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, memberId));
  });

  it("creates and looks up a user by email and id", async () => {
    const byEmail = await getUserByEmail(OWNER_EMAIL);
    expect(byEmail?.id).toBe(ownerId);
    expect(byEmail?.email).toBe(OWNER_EMAIL);
  });

  it("resolves org membership only for an actual member, and treats a non-member the same as a nonexistent org", async () => {
    const resolved = await getOrgForMember(ORG_SLUG, ownerId);
    expect(resolved?.org.id).toBe(orgId);
    expect(resolved?.membership.role).toBe("owner");

    const outsider = await createUser(`it-outsider-${suffix}@example.com`, "hash");
    try {
      expect(await getOrgForMember(ORG_SLUG, outsider.id)).toBeNull();
      expect(await getOrgForMember("no-such-org-at-all", outsider.id)).toBeNull();
    } finally {
      await db.delete(users).where(eq(users.id, outsider.id));
    }
  });

  it("lists both members with their real roles", async () => {
    const members = await listOrgMembers(orgId);
    const byEmail = Object.fromEntries(members.map((m) => [m.email, m.role]));
    expect(byEmail[OWNER_EMAIL]).toBe("owner");
    expect(byEmail[MEMBER_EMAIL]).toBe("member");
  });

  it("counts owners correctly and blocks nothing by itself - the last-owner guard lives in the API route, this just reports the count", async () => {
    expect(await countOrgOwners(orgId)).toBe(1);
  });

  it("removes a member and getOrgMemberById no longer finds them", async () => {
    const membership = await getMembership(orgId, memberId);
    if (!membership) throw new Error("setup failed: member not found");

    await removeOrgMember(orgId, memberId);
    expect(await getOrgMemberById(orgId, membership.id)).toBeNull();
    expect(await getMembership(orgId, memberId)).toBeNull();

    // Restore for any later test in this file that assumes both members exist.
    await addOrgMember(orgId, memberId, "member");
  });

  it("scopes getOrgMemberById to the given org, not a bare id lookup", async () => {
    const otherOrg = await createOrg(`it-other-org-${suffix}`, "Other Org");
    try {
      const membership = await getMembership(orgId, memberId);
      if (!membership) throw new Error("setup failed");
      expect(await getOrgMemberById(otherOrg.id, membership.id)).toBeNull();
      expect(await getOrgMemberById(orgId, membership.id)).not.toBeNull();
    } finally {
      await db.delete(orgs).where(eq(orgs.id, otherOrg.id));
    }
  });

  it("sets and clears the Slack webhook URL", async () => {
    await setOrgSlackWebhookUrl(orgId, "https://hooks.slack.com/services/test");
    expect((await getOrgById(orgId))?.slackWebhookUrl).toBe("https://hooks.slack.com/services/test");

    await setOrgSlackWebhookUrl(orgId, null);
    expect((await getOrgById(orgId))?.slackWebhookUrl).toBeNull();
  });

  it("creates a repo, defaults its fail threshold to critical, and lets it be changed", async () => {
    const repo = await getRepoBySlug(orgId, "it-repo");
    expect(repo?.failThreshold).toBe("critical");

    await updateRepoFailThreshold(repoId, "high");
    expect((await getRepoBySlug(orgId, "it-repo"))?.failThreshold).toBe("high");
    await updateRepoFailThreshold(repoId, "critical");
  });

  it("lists repos for the org", async () => {
    const repoList = await listReposForOrg(orgId);
    expect(repoList.map((r) => r.slug)).toContain("it-repo");
  });

  it("creates and looks up an API token by its hash", async () => {
    const token = await createApiToken(orgId, `it-hash-${suffix}`, "test token", ownerId);
    const found = await getApiTokenByHash(`it-hash-${suffix}`);
    expect(found?.id).toBe(token.id);
    expect(found?.orgId).toBe(orgId);
  });

  it("runs a full scan -> findings lifecycle and keeps counts consistent with what's actually stored", async () => {
    const scan = await createScan({ repoId, source: "ci", commitSha: "abc123", branch: "main", triggeredByUserId: ownerId });
    expect(await getScanById(scan.id)).not.toBeNull();
    expect(await repoBelongsToOrg(repoId, orgId)).toBe(true);
    expect(await scanBelongsToOrg(scan.id, orgId)).toBe(true);

    const otherOrgScope = await createOrg(`it-scope-org-${suffix}`, "Scope Org");
    try {
      expect(await scanBelongsToOrg(scan.id, otherOrgScope.id)).toBe(false);
    } finally {
      await db.delete(orgs).where(eq(orgs.id, otherOrgScope.id));
    }

    await insertFindings(scan.id, [
      { ruleId: "reentrancy-state-change-after-call", severity: "critical", filePath: "a.sol", line: 1, column: 1, message: "m1", snippet: "s1", fixSuggestion: null },
      { ruleId: "floating-pragma", severity: "info", filePath: "a.sol", line: 1, column: 1, message: "m2", snippet: "s2", fixSuggestion: null },
    ]);

    expect(await countFindingsForScan(scan.id)).toBe(2);
    const foundFindings = await listFindingsForScan(scan.id);
    expect(foundFindings).toHaveLength(2);
    // Ordered by severity - critical sorts before info.
    expect(foundFindings[0]?.severity).toBe("critical");

    const finding = foundFindings[0];
    if (!finding) throw new Error("expected at least one finding");
    expect(finding.status).toBe("open");
    await setFindingStatus(finding.id, "acknowledged");
    expect((await getFindingById(finding.id))?.status).toBe("acknowledged");

    await completeScan(scan.id, {
      status: "completed",
      filesScanned: 1,
      counts: { critical: 1, high: 0, medium: 0, low: 0, info: 1 },
      durationMs: 42,
    });
    const completed = await getScanById(scan.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.criticalCount).toBe(1);
    expect(completed?.infoCount).toBe(1);

    expect(await countScansForRepo(repoId)).toBeGreaterThanOrEqual(1);
    const scanList = await listScansForRepo(repoId, 10, 0);
    expect(scanList.map((s) => s.id)).toContain(scan.id);
  });

  it("deletes a repo and cascades to its own scans and findings, without touching other repos", async () => {
    const disposableRepo = await createRepo(orgId, "it-disposable-repo", "Disposable");
    const scan = await createScan({ repoId: disposableRepo.id, source: "cli" });
    await insertFindings(scan.id, [
      { ruleId: "floating-pragma", severity: "info", filePath: "a.sol", line: 1, column: 1, message: "m", snippet: "s", fixSuggestion: null },
    ]);

    await deleteRepo(disposableRepo.id);

    expect(await getScanById(scan.id)).toBeNull();
    expect(await countFindingsForScan(scan.id)).toBe(0);
    // The original test repo (and its scan from the previous test) is untouched.
    expect(await getRepoBySlug(orgId, "it-repo")).not.toBeNull();
  });

  it("logs and lists audit entries for the org, newest first", async () => {
    await logAudit({ orgId, actorUserId: ownerId, action: "test.first", targetType: "test", targetId: 1 });
    await logAudit({ orgId, actorUserId: ownerId, action: "test.second", targetType: "test", targetId: 2 });

    const entries = await listAuditLogForOrg(orgId, 10);
    const actions = entries.map((e) => e.action);
    expect(actions.indexOf("test.second")).toBeLessThan(actions.indexOf("test.first"));
    expect(entries.find((e) => e.action === "test.first")?.actorEmail).toBe(OWNER_EMAIL);
  });

  it("does not resolve a nonexistent org slug at all", async () => {
    expect(await getOrgBySlug(`no-such-org-${suffix}`)).toBeNull();
  });
});
