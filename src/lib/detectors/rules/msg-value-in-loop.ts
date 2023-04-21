import parser from "@solidity-parser/parser";
import type { DoWhileStatement, ForStatement, MemberAccess, WhileStatement } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

function isMsgValue(node: unknown): node is MemberAccess {
  const n = node as MemberAccess & { expression?: { type?: string; name?: string } };
  return n?.type === "MemberAccess" && n.memberName === "value" && n.expression?.type === "Identifier" && n.expression?.name === "msg";
}

/**
 * `msg.value` is the total ether sent with the current call - fixed for
 * the whole transaction, not a per-iteration amount. Referencing it
 * inside a loop (to credit each recipient, say) silently reuses the
 * same total on every pass instead of splitting it, which has shown up
 * for real as a way to drain a contract's balance crediting far more
 * than was actually sent.
 */
export const msgValueInLoopDetector: Detector = {
  id: "msg-value-in-loop",
  title: "msg.value read inside a loop",
  severity: "medium",
  description: "msg.value is the total ether sent with this call, fixed for the whole transaction - reading it inside a loop body reuses that same total on every iteration instead of a per-iteration share.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    const checkLoopBody = (body: unknown) => {
      if (!body) return;
      parser.visit(body, {
        MemberAccess(node: MemberAccess) {
          if (!isMsgValue(node)) return;
          findings.push({
            ruleId: msgValueInLoopDetector.id,
            severity: msgValueInLoopDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: "msg.value is read here inside a loop - it's the same fixed total on every iteration, not a per-iteration amount.",
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Compute the per-iteration share once before the loop (e.g. msg.value / recipients.length), or pass each amount in explicitly instead of re-reading msg.value.",
          });
        },
      });
    };

    parser.visit(ctx.ast, {
      ForStatement(node: ForStatement) {
        checkLoopBody(node.body);
      },
      WhileStatement(node: WhileStatement) {
        checkLoopBody(node.body);
      },
      DoWhileStatement(node: DoWhileStatement) {
        checkLoopBody(node.body);
      },
    });

    return findings;
  },
};
