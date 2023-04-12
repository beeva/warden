import parser from "@solidity-parser/parser";
import type { BinaryOperation } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

/** A parenthesized expression, `(x)`, parses as a single-component TupleExpression rather than exposing `x` directly - unwrapped here so `(a / b) * c` matches the same as the unparenthesized form. */
function unwrapParens(node: unknown): unknown {
  const n = node as { type?: string; components?: unknown[] };
  return n?.type === "TupleExpression" && n.components?.length === 1 ? unwrapParens(n.components[0]) : node;
}

function isDivision(node: unknown): node is BinaryOperation {
  const n = unwrapParens(node) as BinaryOperation;
  return n?.type === "BinaryOperation" && n.operator === "/";
}

/**
 * Solidity integer division truncates toward zero - `7 / 2` is `3`, not
 * `3.5`. `(a / b) * c` throws that fraction away before the multiply can
 * use it, which can under-pay a share, under-charge a fee, or round a
 * balance to zero for small enough inputs. The fix is almost always a
 * pure reordering - `(a * c) / b` - so this only flags a division
 * nested directly under a multiplication, never the already-correct
 * multiply-then-divide shape.
 */
export const divideBeforeMultiplyDetector: Detector = {
  id: "divide-before-multiply",
  title: "Division result multiplied afterward - integer precision loss",
  severity: "medium",
  description: "A division's result feeds directly into a multiplication (a / b * c). Integer division truncates, so this loses precision that reordering to (a * c) / b would have kept.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      BinaryOperation(node: BinaryOperation) {
        if (node.operator !== "*") return;
        const divSide = isDivision(node.left) ? node.left : isDivision(node.right) ? node.right : null;
        if (!divSide) return;

        findings.push({
          ruleId: divideBeforeMultiplyDetector.id,
          severity: divideBeforeMultiplyDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: "This division's result is immediately multiplied - the truncation happens before the multiply, instead of after it.",
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: "Reorder so the multiplication runs first and the division runs last: (a * c) / b instead of (a / b) * c.",
        });
      },
    });

    return findings;
  },
};
