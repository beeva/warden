import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { apiTokens, auditLog, findings, orgMembers, orgs, repos, scans, users } from "./schema";
import type { FindingStatus, ScanSource, ScanStatus, Severity } from "./schema";

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function createUser(email: string, passwordHash: string) {
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  if (!user) throw new Error("failed to create user");
  return user;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function createOrg(slug: string, name: string) {
  const [org] = await db.insert(orgs).values({ slug, name }).returning();
  if (!org) throw new Error("failed to create org");
  return org;
}

export async function getOrgBySlug(slug: string) {
  const [org] = await db.select().from(orgs).where(eq(orgs.slug, slug)).limit(1);
  return org ?? null;
}

export async function getOrgById(orgId: number) {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return org ?? null;
}

export async function setOrgSlackWebhookUrl(orgId: number, slackWebhookUrl: string | null) {
  await db.update(orgs).set({ slackWebhookUrl }).where(eq(orgs.id, orgId));
}

export async function addOrgMember(orgId: number, userId: number, role: "owner" | "member") {
  const [member] = await db.insert(orgMembers).values({ orgId, userId, role }).returning();
  if (!member) throw new Error("failed to add org member");
  return member;
}

/** null if either the org doesn't exist or the user isn't a member - callers treat both the same way (404, not a distinct 403), so an org's existence isn't leaked to someone who can't see it. */
export async function getOrgForMember(slug: string, userId: number) {
  const org = await getOrgBySlug(slug);
  if (!org) return null;
  const membership = await getMembership(org.id, userId);
  if (!membership) return null;
  return { org, membership };
}

export async function getMembership(orgId: number, userId: number) {
  const [member] = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId))).limit(1);
  return member ?? null;
}

export async function listOrgsForUser(userId: number) {
  return db
    .select({ id: orgs.id, slug: orgs.slug, name: orgs.name, createdAt: orgs.createdAt, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(eq(orgMembers.userId, userId));
}

/** How many owners an org currently has - used to block removing/demoting the last one, which would leave the org with no one able to manage members, tokens, or repo settings. */
export async function countOrgOwners(orgId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
  return row?.count ?? 0;
}

export async function removeOrgMember(orgId: number, userId: number) {
  await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
}

/** A single org_members row by its own id, scoped to the given org - used to authorize member removal without letting an owner of org A act on org B's membership row by guessing an id. */
export async function getOrgMemberById(orgId: number, memberId: number) {
  const [member] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return member ?? null;
}

export async function listOrgMembers(orgId: number) {
  return db
    .select({ id: orgMembers.id, userId: users.id, email: users.email, role: orgMembers.role, createdAt: orgMembers.createdAt })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));
}

export async function createRepo(orgId: number, slug: string, name: string) {
  const [repo] = await db.insert(repos).values({ orgId, slug, name }).returning();
  if (!repo) throw new Error("failed to create repo");
  return repo;
}

export async function getRepoBySlug(orgId: number, slug: string) {
  const [repo] = await db.select().from(repos).where(and(eq(repos.orgId, orgId), eq(repos.slug, slug))).limit(1);
  return repo ?? null;
}

export async function getRepoById(repoId: number) {
  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId)).limit(1);
  return repo ?? null;
}

export async function listReposForOrg(orgId: number) {
  return db.select().from(repos).where(eq(repos.orgId, orgId)).orderBy(repos.createdAt);
}

export async function updateRepoFailThreshold(repoId: number, failThreshold: Severity) {
  await db.update(repos).set({ failThreshold }).where(eq(repos.id, repoId));
}

export async function deleteRepo(repoId: number) {
  await db.delete(repos).where(eq(repos.id, repoId));
}

export async function createApiToken(orgId: number, tokenHash: string, label: string, createdByUserId: number) {
  const [token] = await db.insert(apiTokens).values({ orgId, tokenHash, label, createdByUserId }).returning();
  if (!token) throw new Error("failed to create api token");
  return token;
}

export async function getApiTokenByHash(tokenHash: string) {
  const [token] = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash)).limit(1);
  return token ?? null;
}

export async function touchApiTokenLastUsed(tokenId: number) {
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, tokenId));
}

export async function listApiTokensForOrg(orgId: number) {
  return db
    .select({ id: apiTokens.id, label: apiTokens.label, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .where(eq(apiTokens.orgId, orgId))
    .orderBy(desc(apiTokens.createdAt));
}

export async function deleteApiToken(tokenId: number) {
  await db.delete(apiTokens).where(eq(apiTokens.id, tokenId));
}

export async function createScan(input: {
  repoId: number;
  triggeredByUserId?: number | null;
  triggeredByTokenId?: number | null;
  source: ScanSource;
  commitSha?: string | null;
  branch?: string | null;
}) {
  const [scan] = await db.insert(scans).values({ ...input, status: "running" }).returning();
  if (!scan) throw new Error("failed to create scan");
  return scan;
}

export async function completeScan(
  scanId: number,
  input: {
    status: ScanStatus;
    filesScanned: number;
    counts: Record<Severity, number>;
    durationMs: number;
    errorMessage?: string | null;
  }
) {
  await db
    .update(scans)
    .set({
      status: input.status,
      filesScanned: input.filesScanned,
      criticalCount: input.counts.critical,
      highCount: input.counts.high,
      mediumCount: input.counts.medium,
      lowCount: input.counts.low,
      infoCount: input.counts.info,
      durationMs: input.durationMs,
      errorMessage: input.errorMessage ?? null,
      completedAt: new Date(),
    })
    .where(eq(scans.id, scanId));
}

export async function getScanById(scanId: number) {
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId)).limit(1);
  return scan ?? null;
}

export async function listScansForRepo(repoId: number, limit = 50, offset = 0) {
  return db.select().from(scans).where(eq(scans.repoId, repoId)).orderBy(desc(scans.startedAt)).limit(limit).offset(offset);
}

export async function countScansForRepo(repoId: number): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(scans).where(eq(scans.repoId, repoId));
  return row?.count ?? 0;
}

export async function insertFindings(
  scanId: number,
  rows: { ruleId: string; severity: Severity; filePath: string; line: number; column: number | null; message: string; snippet: string; fixSuggestion: string | null }[]
) {
  if (rows.length === 0) return;
  await db.insert(findings).values(rows.map((r) => ({ scanId, ...r })));
}

export async function listFindingsForScan(scanId: number, limit = 50, offset = 0) {
  return db
    .select()
    .from(findings)
    .where(eq(findings.scanId, scanId))
    .orderBy(findings.severity, findings.filePath, findings.line)
    .limit(limit)
    .offset(offset);
}

export async function countFindingsForScan(scanId: number): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(findings).where(eq(findings.scanId, scanId));
  return row?.count ?? 0;
}

export async function getFindingById(findingId: number) {
  const [finding] = await db.select().from(findings).where(eq(findings.id, findingId)).limit(1);
  return finding ?? null;
}

export async function setFindingStatus(findingId: number, status: FindingStatus) {
  await db.update(findings).set({ status }).where(eq(findings.id, findingId));
}

/** Whether a repo (looked up by id) belongs to the given org - the join used to authorize any repo/scan/finding-scoped action against the org a caller is actually a member of. */
export async function repoBelongsToOrg(repoId: number, orgId: number): Promise<boolean> {
  const [repo] = await db.select({ id: repos.id }).from(repos).where(and(eq(repos.id, repoId), eq(repos.orgId, orgId))).limit(1);
  return !!repo;
}

export async function scanBelongsToOrg(scanId: number, orgId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: scans.id })
    .from(scans)
    .innerJoin(repos, eq(scans.repoId, repos.id))
    .where(and(eq(scans.id, scanId), eq(repos.orgId, orgId)))
    .limit(1);
  return !!row;
}

export async function logAudit(input: { orgId: number; actorUserId: number | null; action: string; targetType: string; targetId?: number | null; metadata?: unknown }) {
  await db.insert(auditLog).values({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function listAuditLogForOrg(orgId: number, limit = 50) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/** Open critical/high finding counts for a repo's most recent completed scan - what a CI gate actually checks. */
export async function latestScanSummary(repoId: number) {
  const [scan] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.repoId, repoId), eq(scans.status, "completed")))
    .orderBy(desc(scans.startedAt))
    .limit(1);
  return scan ?? null;
}

export async function orgFindingCounts(orgId: number) {
  const rows = await db
    .select({ severity: findings.severity, count: sql<number>`count(*)::int` })
    .from(findings)
    .innerJoin(scans, eq(findings.scanId, scans.id))
    .innerJoin(repos, eq(scans.repoId, repos.id))
    .where(and(eq(repos.orgId, orgId), eq(findings.status, "open")))
    .groupBy(findings.severity);
  return rows;
}
