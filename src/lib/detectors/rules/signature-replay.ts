import parser from "@solidity-parser/parser";
import type { FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, lineSnippet, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const REPLAY_PROTECTION_NAME_PATTERN = /nonce|used/i;

/** True if the function's own body references any state variable whose name suggests replay protection (a nonce counter, or a used[hash]/used[signature] mapping). Heuristic, not a guarantee - it can't confirm the mechanism is applied correctly, only that something shaped like one exists. */
function referencesReplayProtection(fn: { body: unknown }, stateVarNames: Set<string>): boolean {
  let found = false;
  parser.visit(fn.body, {
    Identifier(node: { name: string }) {
      if (stateVarNames.has(node.name) && REPLAY_PROTECTION_NAME_PATTERN.test(node.name)) found = true;
    },
  });
  return found;
}

/**
 * SWC-121-adjacent: `ecrecover` verifies that a signature was produced by
 * a given key, but says nothing about whether that exact signature has
 * already been used - without a nonce or a used-signature mapping, a
 * previously valid signed message (a meta-transaction, a permit, a
 * withdrawal authorization) can be replayed indefinitely. This is a
 * heuristic check - it can only confirm that *something* shaped like
 * replay protection exists in the function, not that it's wired up
 * correctly, so treat a clean result as "nothing obviously missing," not
 * a guarantee.
 */
export const signatureReplayDetector: Detector = {
  id: "signature-replay-risk",
  title: "Signature verified with no apparent replay protection",
  severity: "medium",
  description: "ecrecover is used to verify a signature, but the function shows no sign of a nonce or used-signature mapping guarding against the same signature being replayed.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;

      let usesEcrecover = false;
      let ecrecoverLine = 0;
      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall) {
          const callee = node.expression as { type?: string; name?: string };
          if (callee.type === "Identifier" && callee.name === "ecrecover") {
            usesEcrecover = true;
            ecrecoverLine ||= nodeLine(node);
          }
        },
      });
      if (!usesEcrecover) continue;

      // stateVars is recomputed per-detector-run rather than passed in,
      // matching every other detector's contract (ctx carries only the
      // AST and source, not derived indexes) - cheap enough that sharing
      // it isn't worth the extra parameter.
      const stateVars = new Set<string>();
      parser.visit(ctx.ast, {
        StateVariableDeclaration(node: { variables: { name: string | null }[] }) {
          for (const v of node.variables) if (v.name) stateVars.add(v.name);
        },
      });
      if (referencesReplayProtection(fn, stateVars)) continue;

      findings.push({
        ruleId: signatureReplayDetector.id,
        severity: signatureReplayDetector.severity,
        line: ecrecoverLine,
        column: 1,
        message: `${fn.name ?? "this function"} verifies a signature with ecrecover but references no nonce/used-signature state - the same signature may be replayable.`,
        snippet: lineSnippet(ctx.sourceLines, ecrecoverLine),
        fixSuggestion: "Track used signatures (mapping(bytes32 => bool) used) or include and check an incrementing nonce in the signed message.",
      });
    }

    return findings;
  },
};
