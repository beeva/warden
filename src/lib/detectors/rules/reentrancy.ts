import parser from "@solidity-parser/parser";
import type { BaseASTNode, BinaryOperation, FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import {
  collectFunctions,
  collectStateVariableNames,
  hasModifierMatching,
  isMemberCall,
  lineSnippet,
  nodeColumn,
  nodeLine,
} from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const ASSIGNMENT_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "|=", "&=", "^=", "<<=", ">>="]);
const EXTERNAL_CALL_MEMBERS = ["call"];
const GUARD_MODIFIER_PATTERN = /nonreentrant|noreentran(t|cy)|lock/i;

/** Unwraps `balances[msg.sender]` / `s.balance` down to the base identifier name, or null if the left-hand side isn't state-variable shaped. */
function baseIdentifierName(node: BaseASTNode): string | null {
  const n = node as BaseASTNode & { type: string; base?: BaseASTNode; expression?: BaseASTNode; name?: string };
  if (n.type === "Identifier") return n.name ?? null;
  if (n.type === "IndexAccess" && n.base) return baseIdentifierName(n.base);
  if (n.type === "MemberAccess" && n.expression) return baseIdentifierName(n.expression);
  return null;
}

/**
 * Classic checks-effects-interactions violation (SWC-107): a low-level
 * `.call(...)` that can hand control to arbitrary attacker code, followed
 * -textually later in the same function, with no reentrancy-guard
 * modifier - by a write to a state variable. The write happening after
 * the call is exactly the bug: a reentrant call during `.call(...)` sees
 * the pre-update state, which is what enables the classic
 * drain-the-balance exploit.
 */
export const reentrancyDetector: Detector = {
  id: "reentrancy-state-change-after-call",
  title: "State change after an external call",
  severity: "critical",
  description:
    "A low-level external call is followed by a state write in the same function, with no reentrancy guard - an attacker-controlled callee can re-enter before state is updated.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];
    const stateVars = collectStateVariableNames(ctx.ast);
    if (stateVars.size === 0) return findings;

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;
      if (hasModifierMatching(fn, GUARD_MODIFIER_PATTERN)) continue;

      const calls: { rangeStart: number; node: FunctionCall }[] = [];
      const writes: { rangeStart: number; node: BinaryOperation }[] = [];

      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall) {
          const match = isMemberCall(node, EXTERNAL_CALL_MEMBERS);
          if (match && node.range) calls.push({ rangeStart: node.range[0], node });
        },
        BinaryOperation(node: BinaryOperation) {
          if (!ASSIGNMENT_OPS.has(node.operator) || !node.range) return;
          const target = baseIdentifierName(node.left as BaseASTNode);
          if (target && stateVars.has(target)) writes.push({ rangeStart: node.range[0], node });
        },
      });

      if (calls.length === 0 || writes.length === 0) continue;

      const earliestCall = calls.reduce((min, c) => (c.rangeStart < min.rangeStart ? c : min));
      const laterWrite = writes.find((w) => w.rangeStart > earliestCall.rangeStart);
      if (!laterWrite) continue;

      findings.push({
        ruleId: reentrancyDetector.id,
        severity: reentrancyDetector.severity,
        line: nodeLine(earliestCall.node),
        column: nodeColumn(earliestCall.node),
        message: `External call on line ${nodeLine(earliestCall.node)} is followed by a state write on line ${nodeLine(laterWrite.node)} with no reentrancy guard.`,
        snippet: lineSnippet(ctx.sourceLines, nodeLine(earliestCall.node)),
        fixSuggestion:
          "Apply the checks-effects-interactions pattern: update all state before making the external call, or add a nonReentrant guard modifier.",
      });
    }

    return findings;
  },
};
