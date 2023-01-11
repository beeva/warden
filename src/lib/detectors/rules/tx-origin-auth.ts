import parser from "@solidity-parser/parser";
import type { BinaryOperation, MemberAccess } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

function isTxOrigin(node: unknown): boolean {
  const n = node as MemberAccess & { expression?: { type?: string; name?: string } };
  return n?.type === "MemberAccess" && n.memberName === "origin" && n.expression?.type === "Identifier" && n.expression?.name === "tx";
}

/**
 * SWC-115: `tx.origin` is the original EOA that kicked off the whole
 * transaction, not the immediate caller. Using it for authorization means
 * a malicious contract the victim interacts with can act as a
 * confused-deputy proxy - it calls into the victim's own contract, and
 * `tx.origin` still resolves to the victim, passing the check. `msg.sender`
 * doesn't have this hole.
 */
export const txOriginAuthDetector: Detector = {
  id: "tx-origin-authorization",
  title: "tx.origin used for authorization",
  severity: "high",
  description: "tx.origin is compared for an authorization check - vulnerable to a malicious intermediary contract acting as a confused deputy.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      BinaryOperation(node: BinaryOperation) {
        if (node.operator !== "==" && node.operator !== "!=") return;
        if (!isTxOrigin(node.left) && !isTxOrigin(node.right)) return;

        findings.push({
          ruleId: txOriginAuthDetector.id,
          severity: txOriginAuthDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: "tx.origin is compared here, which authenticates the original transaction sender rather than the immediate caller.",
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: "Use msg.sender for authorization checks; reserve tx.origin for cases that genuinely need the originating EOA.",
        });
      },
    });

    return findings;
  },
};
