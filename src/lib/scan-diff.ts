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

export function diffScans(previous: DiffableFinding[], current: DiffableFinding[]): ScanDiff {
  const previousKeys = new Set(previous.map(keyOf));
  const currentKeys = new Set(current.map(keyOf));

  let unchangedCount = 0;
  for (const key of currentKeys) {
    if (previousKeys.has(key)) unchangedCount += 1;
  }

  return {
    newCount: currentKeys.size - unchangedCount,
    resolvedCount: previousKeys.size - unchangedCount,
    unchangedCount,
  };
}
