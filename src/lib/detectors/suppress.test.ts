import { describe, expect, it } from "vitest";
import { applySuppressions } from "./suppress";
import type { RawFinding } from "./types";

function finding(overrides: Partial<RawFinding>): RawFinding {
  return {
    ruleId: "reentrancy-state-change-after-call",
    severity: "critical",
    line: 3,
    column: 1,
    message: "m",
    snippet: "s",
    fixSuggestion: "f",
    ...overrides,
  };
}

describe("applySuppressions", () => {
  it("suppresses a finding with a bare warden-ignore on the same line", () => {
    const source = ["a", "b", 'to.call{value: x}(""); // warden-ignore'];
    expect(applySuppressions(source, [finding({ line: 3 })])).toHaveLength(0);
  });

  it("suppresses a finding with a bare warden-ignore on the line above", () => {
    const source = ["a", "// warden-ignore", 'to.call{value: x}("");'];
    expect(applySuppressions(source, [finding({ line: 3 })])).toHaveLength(0);
  });

  it("suppresses only the named rule when a rule list is given", () => {
    const source = ["a", "b", 'to.call{value: x}(""); // warden-ignore: reentrancy-state-change-after-call'];
    const other = finding({ line: 3, ruleId: "unchecked-low-level-call" });
    const matching = finding({ line: 3, ruleId: "reentrancy-state-change-after-call" });
    expect(applySuppressions(source, [other, matching])).toEqual([other]);
  });

  it("supports a comma-separated rule list", () => {
    const source = ["a", "b", "x; // warden-ignore: rule-a, rule-b"];
    const a = finding({ line: 3, ruleId: "rule-a" });
    const b = finding({ line: 3, ruleId: "rule-b" });
    const c = finding({ line: 3, ruleId: "rule-c" });
    expect(applySuppressions(source, [a, b, c])).toEqual([c]);
  });

  it("does not suppress a finding on an unrelated line", () => {
    const source = ["// warden-ignore", "", 'to.call{value: x}("");'];
    expect(applySuppressions(source, [finding({ line: 3 })])).toHaveLength(1);
  });

  it("does not treat the text warden-ignore inside a string literal as a comment suppression", () => {
    const source = ["a", "b", 'string memory s = "warden-ignore";'];
    expect(applySuppressions(source, [finding({ line: 3 })])).toHaveLength(1);
  });
});
