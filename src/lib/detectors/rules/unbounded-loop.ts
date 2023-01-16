import parser from "@solidity-parser/parser";
import type { ForStatement, FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, isMemberCall, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const EXTERNAL_CALL_MEMBERS = ["call", "transfer", "send"];

function boundedByDynamicLength(node: ForStatement): boolean {
  const cond = node.conditionExpression as { type?: string; right?: { type?: string; memberName?: string } } | undefined;
  return cond?.type === "BinaryOperation" && cond.right?.type === "MemberAccess" && cond.right.memberName === "length";
}

function containsExternalCall(node: unknown): boolean {
  let found = false;
  parser.visit(node, {
    FunctionCall(n: FunctionCall) {
      if (isMemberCall(n, EXTERNAL_CALL_MEMBERS)) found = true;
    },
  });
  return found;
}

/**
 * Unbounded-length loop making an external call/transfer per iteration:
 * gas cost grows with however large the underlying array has become by
 * the time the function runs, so it can exceed the block gas limit and
 * make the function permanently uncallable once the array grows past
 * that point - a griefing vector, since anyone who can grow the array
 * (e.g. by being added to a payout list) can eventually brick it for
 * everyone.
 */
export const unboundedLoopDetector: Detector = {
  id: "unbounded-loop-external-call",
  title: "External call inside an unbounded loop",
  severity: "medium",
  description: "A loop bounded by a dynamic array's current length makes an external call/transfer per iteration - can exceed the block gas limit as the array grows.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;

      parser.visit(fn.body, {
        ForStatement(node: ForStatement) {
          if (!boundedByDynamicLength(node) || !containsExternalCall(node.body)) return;

          findings.push({
            ruleId: unboundedLoopDetector.id,
            severity: unboundedLoopDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: "This loop runs once per element of a dynamic-length array and makes an external call each iteration - gas cost scales with the array's size at call time.",
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Use a pull-payment pattern (let each recipient claim their own funds) instead of pushing to everyone in one loop, or cap/paginate the iteration.",
          });
        },
      });
    }

    return findings;
  },
};
