import parser from "@solidity-parser/parser";
import type { ASTNode, FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { isMemberCall, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

// transfer(to, amount) and transferFrom(from, to, amount) are the ERC20
// signatures - distinguished from address.transfer(amount)'s single
// argument, which is a completely different, built-in method that
// reverts on failure by itself.
const ERC20_ARITY: Record<string, number> = { transfer: 2, transferFrom: 3 };

/**
 * Some ERC20 tokens (most infamously USDT) don't follow the standard's
 * own recommendation to revert on failure - they return `false` instead.
 * Code that calls .transfer/.transferFrom as a bare statement and never
 * checks that return value silently treats a failed transfer as
 * successful, which is exactly backwards for anything that credits a
 * balance or releases funds based on "the transfer happened."
 */
export const uncheckedErc20TransferDetector: Detector = {
  id: "unchecked-erc20-transfer",
  title: "Unchecked ERC20 transfer return value",
  severity: "medium",
  description: "An ERC20 transfer/transferFrom call's boolean return value is discarded - some tokens return false on failure instead of reverting.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      FunctionCall(node: FunctionCall, parent?: ASTNode) {
        const match = isMemberCall(node, Object.keys(ERC20_ARITY));
        if (!match) return;
        if (node.arguments.length !== ERC20_ARITY[match.memberName]) return;
        if (!parent || parent.type !== "ExpressionStatement") return;

        findings.push({
          ruleId: uncheckedErc20TransferDetector.id,
          severity: uncheckedErc20TransferDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: `.${match.memberName}(...) here is called as a bare statement - its boolean return value (false on a non-reverting failure) is never checked.`,
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: `Wrap in require(token.${match.memberName}(...), "transfer failed"), or use OpenZeppelin's SafeERC20.safe${match.memberName[0]?.toUpperCase()}${match.memberName.slice(1)}.`,
        });
      },
    });

    return findings;
  },
};
