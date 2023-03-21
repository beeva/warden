import { describe, expect, it } from "vitest";
import { findingsToCsv } from "./findings-csv";
import type { Finding } from "@/lib/db/schema";

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: 1,
    scanId: 1,
    ruleId: "reentrancy-state-change-after-call",
    severity: "critical",
    filePath: "a.sol",
    line: 10,
    column: 5,
    message: "m",
    snippet: "s",
    fixSuggestion: "f",
    status: "open",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("findingsToCsv", () => {
  it("produces a header row plus one row per finding", () => {
    const csv = findingsToCsv([finding({}), finding({ ruleId: "floating-pragma", severity: "info" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("severity,ruleId,filePath,line,column,message,fixSuggestion,status");
    expect(lines[1]).toContain("critical,reentrancy-state-change-after-call,a.sol,10,5,m,f,open");
  });

  it("quotes a field containing a comma", () => {
    const csv = findingsToCsv([finding({ message: "a, b, c" })]);
    expect(csv).toContain('"a, b, c"');
  });

  it("quotes and escapes a field containing a double quote", () => {
    const csv = findingsToCsv([finding({ message: 'say "hi"' })]);
    expect(csv).toContain('"say ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    const csv = findingsToCsv([finding({ message: "line one\nline two" })]);
    expect(csv).toContain('"line one\nline two"');
  });

  it("leaves a plain field unquoted", () => {
    const csv = findingsToCsv([finding({ message: "plain text" })]);
    expect(csv).toContain(",plain text,");
    expect(csv).not.toContain('"plain text"');
  });

  it("renders a null column/fixSuggestion as an empty field, not the string 'null'", () => {
    const csv = findingsToCsv([finding({ column: null, fixSuggestion: null })]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).not.toContain("null");
    expect(dataLine?.split(",")[3]).toBe("10"); // line
    expect(dataLine?.split(",")[4]).toBe(""); // column
  });

  it("produces just the header for an empty findings list", () => {
    expect(findingsToCsv([])).toBe("severity,ruleId,filePath,line,column,message,fixSuggestion,status");
  });
});
