import type { Finding } from "@/lib/db/schema";

const COLUMNS = ["severity", "ruleId", "filePath", "line", "column", "message", "fixSuggestion", "status"] as const;

/**
 * RFC 4180-shaped: a field is quoted whenever it contains a comma, a
 * double quote, or a newline (findings' own message/fixSuggestion text
 * can contain any of the three), and an embedded quote is escaped by
 * doubling it. Fields that don't need quoting are left bare rather than
 * quoted unconditionally, matching what most real CSV consumers
 * (Excel, Google Sheets) themselves produce.
 */
function csvField(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function findingsToCsv(findings: Finding[]): string {
  const header = COLUMNS.join(",");
  const rows = findings.map((finding) =>
    [
      csvField(finding.severity),
      csvField(finding.ruleId),
      csvField(finding.filePath),
      csvField(finding.line),
      csvField(finding.column),
      csvField(finding.message),
      csvField(finding.fixSuggestion),
      csvField(finding.status),
    ].join(",")
  );
  // \r\n line endings, per RFC 4180 - some spreadsheet tools are picky
  // about a bare \n and will show every row jammed into column A.
  return [header, ...rows].join("\r\n");
}
