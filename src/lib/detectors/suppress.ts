import type { RawFinding } from "./types";

// Matches `// warden-ignore` (suppresses every rule on that line) or
// `// warden-ignore: rule-a, rule-b` (suppresses just those rules).
// Anchored to a `//` line comment specifically - a string literal that
// happens to contain the text "warden-ignore" shouldn't suppress
// anything, only an actual comment should.
const SUPPRESSION_PATTERN = /\/\/\s*warden-ignore(?::\s*([\w,\s-]+))?/;

interface Suppression {
  ruleIds: Set<string> | "all";
}

function parseSuppression(line: string | undefined): Suppression | null {
  if (!line) return null;
  const match = SUPPRESSION_PATTERN.exec(line);
  if (!match) return null;
  const list = match[1]?.trim();
  if (!list) return { ruleIds: "all" };
  return { ruleIds: new Set(list.split(",").map((id) => id.trim()).filter(Boolean)) };
}

function suppresses(suppression: Suppression, ruleId: string): boolean {
  return suppression.ruleIds === "all" || suppression.ruleIds.has(ruleId);
}

/**
 * A suppression comment on a finding's own line, or the line directly
 * above it, silences that finding - the same "inline or line-above"
 * convention as `eslint-disable-next-line`, so a developer can suppress
 * either a one-line statement or annotate the line just before a
 * multi-line one. Applied once, centrally, after every detector has run,
 * rather than making each detector aware of suppression comments itself.
 */
export function applySuppressions(sourceLines: string[], findings: RawFinding[]): RawFinding[] {
  return findings.filter((finding) => {
    const sameLine = parseSuppression(sourceLines[finding.line - 1]);
    if (sameLine && suppresses(sameLine, finding.ruleId)) return false;

    const lineAbove = parseSuppression(sourceLines[finding.line - 2]);
    if (lineAbove && suppresses(lineAbove, finding.ruleId)) return false;

    return true;
  });
}
