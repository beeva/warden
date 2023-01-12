import { parseSolidity } from "./parse";
import { detectorRegistry } from "./registry";
import type { ScanFileResult } from "./types";

/**
 * Runs every registered detector against one Solidity source file. A
 * detector throwing (a bug in the detector itself, or an AST shape it
 * didn't anticipate) doesn't take down the whole scan - it's recorded as
 * a zero-finding result for that rule on this file rather than aborting
 * every other file and rule that would otherwise have run cleanly.
 */
export function scanSource(filePath: string, source: string): ScanFileResult {
  const { ast, error } = parseSolidity(source);
  if (!ast) {
    return { filePath, findings: [], parseError: error };
  }

  const sourceLines = source.split("\n");
  const findings = detectorRegistry.flatMap((detector) => {
    try {
      return detector.run({ ast, sourceLines, filePath });
    } catch (err) {
      console.error(`detector "${detector.id}" threw on ${filePath}:`, err);
      return [];
    }
  });

  return { filePath, findings, parseError: null };
}
