import parser from "@solidity-parser/parser";
import type { BinaryOperation, FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

/** True if the function's body contains any comparison against `address(0)` at all - a coarse but real signal that the zero-address case is handled somewhere, the same style of heuristic the other detectors in this engine use (missing-zero-address-check, locked-ether). */
function hasZeroAddressCheck(fn: { body: unknown }): boolean {
  let found = false;
  parser.visit(fn.body, {
    BinaryOperation(node: BinaryOperation) {
      if (node.operator !== "==" && node.operator !== "!=") return;
      const serialized = JSON.stringify([node.left, node.right]);
      if (serialized.includes('"name":"address"') && serialized.includes('"number":"0"')) found = true;
    },
  });
  return found;
}

/**
 * SWC-121-adjacent: `ecrecover` returns `address(0)` for certain
 * malformed inputs (an invalid signature, or `v`/`r`/`s` values outside
 * their valid range) instead of reverting. Code that uses its result
 * directly in an authorization check - `ecrecover(...) == owner` - without
 * ever ruling out the zero address is safe in the common case (a real
 * owner is never the zero address) but silently depends on that,
 * rather than checking it, which breaks the moment any default/
 * uninitialized state happens to be address(0) somewhere in the same
 * comparison chain.
 */
export const ecrecoverZeroAddressDetector: Detector = {
  id: "ecrecover-unchecked-zero-address",
  title: "ecrecover result never checked against the zero address",
  severity: "low",
  description: "ecrecover returns address(0) for certain malformed signatures rather than reverting - a function using its result with no zero-address check anywhere relies on that implicitly instead of verifying it.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;
      if (hasZeroAddressCheck(fn)) continue;

      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall) {
          const callee = node.expression as { type?: string; name?: string };
          if (callee.type !== "Identifier" || callee.name !== "ecrecover") return;

          findings.push({
            ruleId: ecrecoverZeroAddressDetector.id,
            severity: ecrecoverZeroAddressDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: `${fn.name ?? "this function"} calls ecrecover but never checks its result against address(0) anywhere.`,
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Add require(signer != address(0), \"invalid signature\") before trusting the recovered address.",
          });
        },
      });
    }

    return findings;
  },
};
