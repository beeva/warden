import parser from "@solidity-parser/parser";
import type { BinaryOperation, MemberAccess } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const COMPARISON_OPS = new Set(["<", ">", "<=", ">=", "==", "!="]);

function isBlockTimestamp(node: unknown): boolean {
  const n = node as MemberAccess & { expression?: { type?: string; name?: string } };
  return n?.type === "MemberAccess" && n.memberName === "timestamp" && n.expression?.type === "Identifier" && n.expression?.name === "block";
}

/**
 * SWC-116: block.timestamp is set by the block producer and only has to
 * stay within a loosely-enforced tolerance of real time - a validator can
 * nudge it within that window. Using it in a comparison that gates value
 * (a deadline, a game outcome, a price window) gives whoever proposes the
 * block a small but real lever over the outcome. Informational, not
 * critical, since most uses (loose deadlines) are genuinely fine.
 */
export const timestampDependenceDetector: Detector = {
  id: "timestamp-dependence",
  title: "block.timestamp used in a comparison",
  severity: "low",
  description: "block.timestamp is compared directly - block producers have limited but real influence over its value, which matters for tight deadlines or outcome-determining logic.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      BinaryOperation(node: BinaryOperation) {
        if (!COMPARISON_OPS.has(node.operator)) return;
        if (!isBlockTimestamp(node.left) && !isBlockTimestamp(node.right)) return;

        findings.push({
          ruleId: timestampDependenceDetector.id,
          severity: timestampDependenceDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: "block.timestamp is compared here - fine for loose deadlines, risky if the comparison is tight enough for a block producer's small timing latitude to matter.",
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: "If this needs to be precise or manipulation-resistant, use a block-number-based window or an oracle instead of raw block.timestamp.",
        });
      },
    });

    return findings;
  },
};
