import { pgEnum, pgTable, serial, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export const memberRoleEnum = pgEnum("member_role", ["owner", "member"]);
export const scanStatusEnum = pgEnum("scan_status", ["running", "completed", "failed"]);
export const scanSourceEnum = pgEnum("scan_source", ["web", "cli", "ci"]);
export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low", "info"]);
export const findingStatusEnum = pgEnum("finding_status", ["open", "acknowledged", "false_positive", "fixed"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orgs = pgTable("orgs", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // An incoming Slack webhook URL is itself the credential (whoever has
  // it can post as this integration) - stored as an org-level setting,
  // not per-user, since a blocked scan is an org-wide event.
  slackWebhookUrl: text("slack_webhook_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("org_members_org_user_unique").on(table.orgId, table.userId)]
);

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    // The minimum severity that gates a deploy - a scan with a finding at
    // or above this level reports `blocked: true`. Defaults to the
    // strictest useful setting (only true criticals block); an owner can
    // loosen or tighten it per repo since not every repo has the same
    // risk tolerance (a reference/example contract vs. a mainnet deploy).
    failThreshold: severityEnum("fail_threshold").notNull().default("critical"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("repos_org_slug_unique").on(table.orgId, table.slug)]
);

// Tokens are stored as a SHA-256 hash, never the raw value - the same
// pattern as password hashing, so a database leak alone can't be used to
// impersonate a CI pipeline. The raw token is shown to the user exactly
// once, at creation.
export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label").notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id").notNull().references(() => repos.id, { onDelete: "cascade" }),
  triggeredByUserId: integer("triggered_by_user_id").references(() => users.id, { onDelete: "set null" }),
  triggeredByTokenId: integer("triggered_by_token_id").references(() => apiTokens.id, { onDelete: "set null" }),
  source: scanSourceEnum("source").notNull().default("web"),
  commitSha: text("commit_sha"),
  branch: text("branch"),
  status: scanStatusEnum("status").notNull().default("running"),
  filesScanned: integer("files_scanned").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  infoCount: integer("info_count").notNull().default(0),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const findings = pgTable("findings", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  severity: severityEnum("severity").notNull(),
  filePath: text("file_path").notNull(),
  line: integer("line").notNull(),
  column: integer("column"),
  message: text("message").notNull(),
  snippet: text("snippet").notNull(),
  fixSuggestion: text("fix_suggestion"),
  status: findingStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Every scan run and every finding-status change, independent of the
// scans/findings rows themselves - so security posture stays provable
// even across a finding being reclassified or a repo being renamed.
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Org = typeof orgs.$inferSelect;
export type OrgMember = typeof orgMembers.$inferSelect;
export type Repo = typeof repos.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type Scan = typeof scans.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Severity = (typeof severityEnum.enumValues)[number];
export type FindingStatus = (typeof findingStatusEnum.enumValues)[number];
export type ScanStatus = (typeof scanStatusEnum.enumValues)[number];
export type ScanSource = (typeof scanSourceEnum.enumValues)[number];
