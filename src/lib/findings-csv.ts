import type { Finding } from "@/lib/db/schema";
import { csvField, toCsv } from "@/lib/csv";

const COLUMNS = ["severity", "ruleId", "filePath", "line", "column", "message", "fixSuggestion", "status"];

export function findingsToCsv(findings: Finding[]): string {
  const rows = findings.map((finding) => [
    csvField(finding.severity),
    csvField(finding.ruleId),
    csvField(finding.filePath),
    csvField(finding.line),
    csvField(finding.column),
    csvField(finding.message),
    csvField(finding.fixSuggestion),
    csvField(finding.status),
  ]);
  return toCsv(COLUMNS, rows);
}
