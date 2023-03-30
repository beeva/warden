import parser from "@solidity-parser/parser";
import type { FunctionCall, MemberAccess } from "@solidity-parser/parser/dist/src/ast-types";
import { isMemberCall, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const VALUE_SEND_MEMBERS = ["transfer", "send", "call"];
const TOKEN_TRANSFER_MEMBERS = ["transfer", "transferFrom"];

function isTxOrigin(node: unknown): boolean {
  const n = node as MemberAccess & { expression?: { type?: string; name?: string } };
  return n?.type === "MemberAccess" && n.memberName === "origin" && n.expression?.type === "Identifier" && n.expression?.name === "tx";
}

/**
 * A different tx.origin hazard than the authorization-comparison one:
 * using tx.origin as the *destination* of value - `tx.origin.transfer(...)`,
 * or an ERC20 `token.transfer(tx.origin, amount)` - can be redirected by
 * a malicious contract in between. If a victim is tricked into calling
 * through an attacker's contract, tx.origin still resolves to the
 * victim, but the attacker's contract is what's actually making this
 * call - it can pick a *different* tx.origin-driven flow than the
 * victim intended, or the pattern itself is just a sign this contract is
 * conflating "who originally signed the transaction" with "who should
 * receive this payment," which are not the same thing.
 */
export const txOriginAsRecipientDetector: Detector = {
  id: "tx-origin-as-recipient",
  title: "tx.origin used as a value recipient",
  severity: "high",
  description: "tx.origin is used as the destination of a value transfer or token transfer, rather than msg.sender - a confused-deputy contract in between can exploit this the same way it can with tx.origin-based auth.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      FunctionCall(node: FunctionCall) {
        const valueSendMatch = isMemberCall(node, VALUE_SEND_MEMBERS);
        if (valueSendMatch && isTxOrigin(valueSendMatch.base)) {
          findings.push({
            ruleId: txOriginAsRecipientDetector.id,
            severity: txOriginAsRecipientDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: `.${valueSendMatch.memberName}(...) sends value to tx.origin here - use msg.sender instead.`,
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Send value to msg.sender, not tx.origin.",
          });
          return;
        }

        const tokenMatch = isMemberCall(node, TOKEN_TRANSFER_MEMBERS);
        if (!tokenMatch) return;
        if (!node.arguments.some(isTxOrigin)) return;

        findings.push({
          ruleId: txOriginAsRecipientDetector.id,
          severity: txOriginAsRecipientDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: `.${tokenMatch.memberName}(...) passes tx.origin as a recipient here - use msg.sender instead.`,
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: "Pass msg.sender as the recipient, not tx.origin.",
        });
      },
    });

    return findings;
  },
};
