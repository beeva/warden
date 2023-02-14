import type { Severity } from "./detectors/types";

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/** True if any finding meets or exceeds the given severity threshold - what a CI/repo gate checks before blocking. Shared by the CLI's local --fail-on and the dashboard's per-repo failThreshold, so the two can never silently disagree on what "blocked" means. */
export function meetsThreshold(counts: Record<Severity, number>, threshold: Severity): boolean {
  return (Object.keys(counts) as Severity[]).some((severity) => counts[severity] > 0 && RANK[severity] >= RANK[threshold]);
}
