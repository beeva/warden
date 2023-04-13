import { describe, expect, it } from "vitest";
import type { ScanFileResult } from "../lib/detectors/types";
import { formatResultsSarif } from "./sarif";

describe("formatResultsSarif", () => {
  it("produces a valid-shaped SARIF 2.1.0 document", () => {
    const results: ScanFileResult[] = [
      {
        filePath: "contracts/Vault.sol",
        parseError: null,
        findings: [
          {
            ruleId: "reentrancy-state-change-after-call",
            severity: "critical",
            line: 12,
            column: 5,
            message: "state write after an external call",
            snippet: "balances[msg.sender] -= amount;",
            fixSuggestion: "use checks-effects-interactions",
          },
        ],
      },
    ];

    const sarif = JSON.parse(formatResultsSarif(results));
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe("warden");
    expect(sarif.runs[0].results).toHaveLength(1);

    const result = sarif.runs[0].results[0];
    expect(result.ruleId).toBe("reentrancy-state-change-after-call");
    expect(result.level).toBe("error");
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe("contracts/Vault.sol");
    expect(result.locations[0].physicalLocation.region.startLine).toBe(12);
    expect(result.locations[0].physicalLocation.region.startColumn).toBe(5);
  });

  it("lists every registered detector as a rule, even ones with zero findings", () => {
    const sarif = JSON.parse(formatResultsSarif([]));
    const ruleIds = sarif.runs[0].tool.driver.rules.map((r: { id: string }) => r.id);
    expect(ruleIds).toContain("divide-before-multiply");
    expect(ruleIds.length).toBeGreaterThan(20);
  });

  it("maps severity to SARIF level: critical/high to error, medium to warning, low/info to note", () => {
    const base = { filePath: "a.sol", parseError: null } as const;
    const results: ScanFileResult[] = [
      { ...base, findings: [{ ruleId: "r", severity: "high", line: 1, column: 1, message: "m", snippet: "", fixSuggestion: "" }] },
      { ...base, findings: [{ ruleId: "r", severity: "medium", line: 1, column: 1, message: "m", snippet: "", fixSuggestion: "" }] },
      { ...base, findings: [{ ruleId: "r", severity: "low", line: 1, column: 1, message: "m", snippet: "", fixSuggestion: "" }] },
      { ...base, findings: [{ ruleId: "r", severity: "info", line: 1, column: 1, message: "m", snippet: "", fixSuggestion: "" }] },
    ];
    const sarif = JSON.parse(formatResultsSarif(results));
    const levels = sarif.runs[0].results.map((r: { level: string }) => r.level);
    expect(levels).toEqual(["error", "warning", "note", "note"]);
  });

  it("converts a backslash-separated Windows path to forward slashes for the artifact URI", () => {
    const results: ScanFileResult[] = [
      {
        filePath: "contracts\\Vault.sol",
        parseError: null,
        findings: [{ ruleId: "r", severity: "low", line: 1, column: 1, message: "m", snippet: "", fixSuggestion: "" }],
      },
    ];
    const sarif = JSON.parse(formatResultsSarif(results));
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe("contracts/Vault.sol");
  });

  it("produces no results for a file with no findings, but does not error", () => {
    const results: ScanFileResult[] = [{ filePath: "clean.sol", parseError: null, findings: [] }];
    const sarif = JSON.parse(formatResultsSarif(results));
    expect(sarif.runs[0].results).toEqual([]);
  });
});
