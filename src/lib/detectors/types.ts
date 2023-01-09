import type { SourceUnit } from "@solidity-parser/parser/dist/src/ast-types";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface RawFinding {
  ruleId: string;
  severity: Severity;
  line: number;
  column: number;
  message: string;
  snippet: string;
  fixSuggestion: string;
}

export interface DetectorContext {
  ast: SourceUnit;
  sourceLines: string[];
  filePath: string;
}

export interface Detector {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  run(ctx: DetectorContext): RawFinding[];
}

export interface ScanFileResult {
  filePath: string;
  findings: RawFinding[];
  parseError: string | null;
}
