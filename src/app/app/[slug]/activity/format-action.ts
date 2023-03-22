const LABELS: Record<string, string> = {
  "scan.completed": "ran a scan",
  "repo.created": "created a repo",
  "repo.deleted": "deleted a repo",
  "repo.fail_threshold_changed": "changed a repo's CI-gate threshold",
  "repo.ignored_rules_changed": "changed a repo's ignored rules",
  "member.added": "added a member",
  "member.removed": "removed a member",
  "token.created": "created an API token",
  "token.revoked": "revoked an API token",
  "finding.status_changed": "changed a finding's status",
  "slack.connected": "connected Slack",
  "slack.disconnected": "disconnected Slack",
  "github.connected": "connected a GitHub repo",
  "github.disconnected": "disconnected a GitHub repo",
};

export function formatAction(action: string): string {
  return LABELS[action] ?? action;
}

/** A short, best-effort detail string from an entry's metadata - not every action carries metadata worth surfacing, so this returns null rather than an empty/misleading fragment when there's nothing useful to show. */
export function formatDetail(action: string, metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;

  switch (action) {
    case "finding.status_changed":
      return typeof m.from === "string" && typeof m.to === "string" ? `${m.from} → ${m.to}` : null;
    case "repo.fail_threshold_changed":
      return typeof m.from === "string" && typeof m.to === "string" ? `${m.from} → ${m.to}` : null;
    case "scan.completed": {
      const counts = m.counts as Record<string, number> | undefined;
      if (!counts) return null;
      const parts = Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([severity, count]) => `${count} ${severity}`);
      return parts.length > 0 ? parts.join(", ") : "no findings";
    }
    case "repo.deleted":
      return typeof m.name === "string" ? m.name : null;
    default:
      return null;
  }
}
