import parser from "@solidity-parser/parser";
import type { BinaryOperation, UnaryOperation, UncheckedStatement } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const SUBTRACTION_OPERATORS = new Set(["-", "-="]);

/**
 * `unchecked { ... }` opts a block out of Solidity 0.8's default
 * overflow/underflow revert - the exact protection that would otherwise
 * catch a balance going negative. Scoped to subtraction and decrement
 * specifically (never `+`/`++`) because the unguarded-increment-in-a-loop
 * idiom (`unchecked { i++; }`, to shave gas off a counter that's already
 * bounded by the loop condition) is common, intentional, and not the
 * risky direction - underflow is.
 */
export const uncheckedArithmeticBlockDetector: Detector = {
  id: "unchecked-arithmetic-block",
  title: "Subtraction inside an unchecked block",
  severity: "low",
  description: "unchecked { ... } disables Solidity's built-in overflow/underflow revert. A subtraction or decrement inside one needs its own bounds check, since the compiler will no longer provide one.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      UncheckedStatement(uncheckedNode: UncheckedStatement) {
        parser.visit(uncheckedNode.block, {
          BinaryOperation(node: BinaryOperation) {
            if (!SUBTRACTION_OPERATORS.has(node.operator)) return;
            findings.push({
              ruleId: uncheckedArithmeticBlockDetector.id,
              severity: uncheckedArithmeticBlockDetector.severity,
              line: nodeLine(node),
              column: nodeColumn(node),
              message: `This subtraction runs inside an unchecked block - it can underflow silently instead of reverting.`,
              snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
              fixSuggestion: "Add an explicit check (e.g. require(a >= b)) before the subtraction, or move it outside the unchecked block if the gas saving isn't load-bearing.",
            });
          },
          UnaryOperation(node: UnaryOperation) {
            if (node.operator !== "--") return;
            findings.push({
              ruleId: uncheckedArithmeticBlockDetector.id,
              severity: uncheckedArithmeticBlockDetector.severity,
              line: nodeLine(node),
              column: nodeColumn(node),
              message: `This decrement runs inside an unchecked block - it can underflow silently instead of reverting.`,
              snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
              fixSuggestion: "Add an explicit check before decrementing, or move it outside the unchecked block if the gas saving isn't load-bearing.",
            });
          },
        });
      },
    });

    return findings;
  },
};
