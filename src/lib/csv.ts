/**
 * RFC 4180-shaped: a field is quoted whenever it contains a comma, a
 * double quote, or a newline, and an embedded quote is escaped by
 * doubling it. Fields that don't need quoting are left bare rather than
 * quoted unconditionally, matching what most real CSV consumers
 * (Excel, Google Sheets) themselves produce.
 */
export function csvField(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** \r\n line endings throughout, per RFC 4180 - some spreadsheet tools are picky about a bare \n and will show every row jammed into column A. */
export function toCsv(header: string[], rows: string[][]): string {
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}
