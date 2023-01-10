import parser from "@solidity-parser/parser";
import type { ASTNode, FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, isMemberCall, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const LOW_LEVEL_CALL_MEMBERS = ["call", "delegatecall", "staticcall", "send"];

/**
 * SWC-104: a low-level call returns `(bool success, ...)` instead of
 * reverting on failure - `.transfer(...)` is the one exception, since it
 * reverts internally. Using the call as a bare statement (`x.call(...);`)
 * discards that boolean, so a failed call is silently treated as success
 * - state can end up inconsistent with what actually happened on-chain.
 */
export const uncheckedCallDetector: Detector = {
  id: "unchecked-low-level-call",
  title: "Unchecked return value on a low-level call",
  severity: "high",
  description:
    "A low-level call (.call/.delegatecall/.staticcall/.send) is used as a bare statement, so its boolean success value is silently discarded.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;

      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall, parent?: ASTNode) {
          const match = isMemberCall(node, LOW_LEVEL_CALL_MEMBERS);
          if (!match) return;
          if (!parent || parent.type !== "ExpressionStatement") return;

          findings.push({
            ruleId: uncheckedCallDetector.id,
            severity: uncheckedCallDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: `The return value of .${match.memberName}(...) is never checked - a failed call is indistinguishable from a successful one here.`,
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: `Capture and check the result: (bool ok, ) = target.${match.memberName}(...); require(ok, "call failed");`,
          });
        },
      });
    }

    return findings;
  },
};
