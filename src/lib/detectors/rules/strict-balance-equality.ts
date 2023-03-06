import parser from "@solidity-parser/parser";
import type { BinaryOperation } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const EQUALITY_OPS = new Set(["==", "!="]);

function isBalanceExpression(node: unknown): boolean {
  const n = node as { type?: string; memberName?: string; expression?: { type?: string; memberName?: string } };
  if (n?.type === "MemberAccess" && n.memberName === "balance") return true;
  // token.balanceOf(...) - a FunctionCall whose callee is a MemberAccess named balanceOf.
  if (n?.type === "FunctionCall") {
    const callee = (n as { expression?: { type?: string; memberName?: string } }).expression;
    if (callee?.type === "MemberAccess" && callee.memberName === "balanceOf") return true;
  }
  return false;
}

/**
 * SWC-132-adjacent: `address(this).balance == X` (or a token's
 * `balanceOf(this) == X`) looks like a safe sanity check, but anyone can
 * force ether into a contract regardless of whether it has a payable
 * function - by calling selfdestruct(target) from another contract, or
 * by pre-computing the contract's address and sending ether to it before
 * deployment. An ERC20 balance is similarly changeable by anyone via a
 * direct transfer. Exact equality against either can be broken by a
 * griefer with no other access to the contract at all.
 */
export const strictBalanceEqualityDetector: Detector = {
  id: "strict-balance-equality",
  title: "Exact balance equality check",
  severity: "medium",
  description: "A contract's ether or token balance is compared with == / != - anyone can force-send value to break an exact-equality check, regardless of the contract's own logic.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      BinaryOperation(node: BinaryOperation) {
        if (!EQUALITY_OPS.has(node.operator)) return;
        if (!isBalanceExpression(node.left) && !isBalanceExpression(node.right)) return;

        findings.push({
          ruleId: strictBalanceEqualityDetector.id,
          severity: strictBalanceEqualityDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: "A balance is compared with exact equality here - anyone can force-send ether (via selfdestruct) or transfer tokens directly to break this check.",
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: "Use >=/<= instead of ==/!=, or track expected balance in your own state variable rather than trusting the raw balance.",
        });
      },
    });

    return findings;
  },
};
