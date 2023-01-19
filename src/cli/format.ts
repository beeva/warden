import type { Severity } from "../lib/detectors/types";
import type { ScanFileResult } from "../lib/detectors/types";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: ANSI.red,
  high: ANSI.red,
  medium: ANSI.yellow,
  low: ANSI.cyan,
  info: ANSI.gray,
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function countBySeverity(results: ScanFileResult[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const result of results) {
    for (const finding of result.findings) counts[finding.severity] += 1;
  }
  return counts;
}

export function formatResults(results: ScanFileResult[], useColor: boolean): string {
  const lines: string[] = [];
  const color = (code: string, text: string) => (useColor ? `${code}${text}${ANSI.reset}` : text);

  for (const result of results) {
    if (result.parseError) {
      lines.push(color(ANSI.yellow, `! ${result.filePath}: could not parse (${result.parseError})`));
      continue;
    }
    if (result.findings.length === 0) continue;

    lines.push(color(ANSI.bold, result.filePath));
    const sorted = [...result.findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    for (const finding of sorted) {
      const badge = color(SEVERITY_COLOR[finding.severity], finding.severity.toUpperCase().padEnd(8));
      lines.push(`  ${badge} ${finding.line}:${finding.column}  ${finding.message}`);
      lines.push(color(ANSI.dim, `           ${finding.ruleId} - ${finding.fixSuggestion}`));
    }
    lines.push("");
  }

  const counts = countBySeverity(results);
  const summary = SEVERITY_ORDER.filter((s) => counts[s] > 0)
    .map((s) => color(SEVERITY_COLOR[s], `${counts[s]} ${s}`))
    .join(", ");
  const totalFindings = Object.values(counts).reduce((a, b) => a + b, 0);
  const filesScanned = results.length;
  const parseErrors = results.filter((r) => r.parseError).length;

  lines.push(
    totalFindings === 0
      ? color(ANSI.green, `no findings across ${filesScanned} file${filesScanned === 1 ? "" : "s"}`)
      : `${totalFindings} finding${totalFindings === 1 ? "" : "s"} across ${filesScanned} file${filesScanned === 1 ? "" : "s"} (${summary})`
  );
  if (parseErrors > 0) lines.push(color(ANSI.yellow, `${parseErrors} file${parseErrors === 1 ? "" : "s"} could not be parsed`));

  return lines.join("\n");
}
