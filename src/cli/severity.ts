import type { Severity } from "../lib/detectors/types";

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/** True if any finding meets or exceeds the given severity threshold - what a CI gate checks before failing the build. */
export function meetsThreshold(counts: Record<Severity, number>, threshold: Severity): boolean {
  return (Object.keys(counts) as Severity[]).some((severity) => counts[severity] > 0 && RANK[severity] >= RANK[threshold]);
}
