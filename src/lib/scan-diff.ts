export interface DiffableFinding {
  ruleId: string;
  filePath: string;
  line: number;
}

export interface ScanDiff {
  newCount: number;
  resolvedCount: number;
  unchangedCount: number;
}

export interface ScanPartition<T> {
  added: T[];
  resolved: T[];
  unchanged: T[];
}

/**
 * A finding is treated as "the same" across two scans if its rule, file,
 * and line all match - there's no stable identity linking a finding in
 * one scan to "the same" finding in the next (each upload creates
 * entirely new rows), so this is the closest real proxy: if a
 * reentrancy finding disappears from src/Vault.sol:42 between two scans,
 * that's a fixed bug regardless of the two rows' actual database ids.
 */
function keyOf(finding: DiffableFinding): string {
  return `${finding.ruleId}::${finding.filePath}::${finding.line}`;
}

/**
 * The full objects on each side of the diff, not just counts - what a
 * scan-comparison view needs to actually list which findings are new and
 * which were resolved, not just how many. Generic over T so it works
 * equally against the lightweight {ruleId, filePath, line} rows used for
 * the cheap per-scan-page diff and the full Finding rows used for a
 * detailed comparison page.
 */
export function partitionFindings<T extends DiffableFinding>(previous: T[], current: T[]): ScanPartition<T> {
  const previousByKey = new Map(previous.map((f) => [keyOf(f), f]));
  const currentByKey = new Map(current.map((f) => [keyOf(f), f]));

  const added: T[] = [];
  const unchanged: T[] = [];
  for (const [key, finding] of currentByKey) {
    if (previousByKey.has(key)) unchanged.push(finding);
    else added.push(finding);
  }

  const resolved: T[] = [];
  for (const [key, finding] of previousByKey) {
    if (!currentByKey.has(key)) resolved.push(finding);
  }

  return { added, resolved, unchanged };
}

export function diffScans(previous: DiffableFinding[], current: DiffableFinding[]): ScanDiff {
  const { added, resolved, unchanged } = partitionFindings(previous, current);
  return { newCount: added.length, resolvedCount: resolved.length, unchangedCount: unchanged.length };
}
