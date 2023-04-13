import { detectorRegistry } from "../lib/detectors/registry";
import type { ScanFileResult, Severity } from "../lib/detectors/types";

const SARIF_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";

/** SARIF only has error/warning/note - critical and high both read as a blocking error in a PR's Code Scanning tab, low and info both read as a non-blocking note. */
function sarifLevel(severity: Severity): "error" | "warning" | "note" {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "note";
}

/**
 * SARIF 2.1.0 output for `warden scan --format sarif` - the format
 * GitHub's "Upload SARIF" action (and its Code Scanning tab) expects,
 * so a finding can show up as an inline PR annotation instead of only
 * living in warden's own dashboard. The rules list always includes
 * every detector in the registry (not just the ones that fired here),
 * since GitHub uses it to show a rule's description even for a repo
 * that currently has zero findings for it.
 */
export function formatResultsSarif(results: ScanFileResult[]): string {
  const sarifResults = results.flatMap((result) =>
    result.findings.map((finding) => ({
      ruleId: finding.ruleId,
      level: sarifLevel(finding.severity),
      message: { text: finding.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: result.filePath.replace(/\\/g, "/") },
            region: { startLine: Math.max(finding.line, 1), startColumn: Math.max(finding.column, 1) },
          },
        },
      ],
    }))
  );

  return JSON.stringify(
    {
      $schema: SARIF_SCHEMA,
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "warden",
              informationUri: "https://github.com/warden-sec/warden",
              version: "0.1.0",
              rules: detectorRegistry.map((detector) => ({
                id: detector.id,
                name: detector.title,
                shortDescription: { text: detector.description },
                defaultConfiguration: { level: sarifLevel(detector.severity) },
              })),
            },
          },
          results: sarifResults,
        },
      ],
    },
    null,
    2
  );
}
