import { describe, expect, it } from "vitest";
import { diffScans, partitionFindings } from "./scan-diff";

const f = (ruleId: string, filePath: string, line: number) => ({ ruleId, filePath, line });

describe("diffScans", () => {
  it("reports everything as new when there is no previous scan", () => {
    const diff = diffScans([], [f("reentrancy-state-change-after-call", "a.sol", 10)]);
    expect(diff).toEqual({ newCount: 1, resolvedCount: 0, unchangedCount: 0 });
  });

  it("reports everything as resolved when the current scan is clean", () => {
    const diff = diffScans([f("reentrancy-state-change-after-call", "a.sol", 10)], []);
    expect(diff).toEqual({ newCount: 0, resolvedCount: 1, unchangedCount: 0 });
  });

  it("matches a finding across scans by rule + file + line, ignoring row identity", () => {
    const previous = [f("floating-pragma", "a.sol", 1)];
    const current = [f("floating-pragma", "a.sol", 1)];
    expect(diffScans(previous, current)).toEqual({ newCount: 0, resolvedCount: 0, unchangedCount: 1 });
  });

  it("treats the same rule on a different line as a different finding", () => {
    const previous = [f("floating-pragma", "a.sol", 1)];
    const current = [f("floating-pragma", "a.sol", 2)];
    expect(diffScans(previous, current)).toEqual({ newCount: 1, resolvedCount: 1, unchangedCount: 0 });
  });

  it("handles a mix of new, resolved, and unchanged findings in one diff", () => {
    const previous = [f("a", "x.sol", 1), f("b", "x.sol", 2), f("c", "x.sol", 3)];
    const current = [f("b", "x.sol", 2), f("c", "x.sol", 3), f("d", "x.sol", 4)];
    // a resolved, b/c unchanged, d new
    expect(diffScans(previous, current)).toEqual({ newCount: 1, resolvedCount: 1, unchangedCount: 2 });
  });
});

describe("partitionFindings", () => {
  it("returns the actual finding objects in each bucket, not just counts", () => {
    const stayed = f("b", "x.sol", 2);
    const wentAway = f("a", "x.sol", 1);
    const showedUp = f("d", "x.sol", 4);
    const partition = partitionFindings([wentAway, stayed], [stayed, showedUp]);

    expect(partition.added).toEqual([showedUp]);
    expect(partition.resolved).toEqual([wentAway]);
    expect(partition.unchanged).toEqual([stayed]);
  });

  it("preserves extra fields beyond ruleId/filePath/line on the returned objects", () => {
    const richFinding = { ruleId: "x", filePath: "a.sol", line: 1, severity: "critical", message: "danger" };
    const partition = partitionFindings([], [richFinding]);
    expect(partition.added[0]).toEqual(richFinding);
  });

  it("agrees with diffScans on the counts for the same input", () => {
    const previous = [f("a", "x.sol", 1), f("b", "x.sol", 2)];
    const current = [f("b", "x.sol", 2), f("c", "x.sol", 3)];
    const partition = partitionFindings(previous, current);
    const counts = diffScans(previous, current);
    expect({ newCount: partition.added.length, resolvedCount: partition.resolved.length, unchangedCount: partition.unchanged.length }).toEqual(counts);
  });
});
