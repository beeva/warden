import parser from "@solidity-parser/parser";
import type { FunctionCall, UnaryOperation } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, collectStateVariableNames, hasModifierMatching, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const INITIALIZER_NAME_PATTERN = /^initialize/i;
const INITIALIZER_GUARD_MODIFIER_PATTERN = /initializer|onlyinit/i;

/** True if the function's own body contains `require(!x)`/`require(!x, ...)` for some identifier x - the manual equivalent of OpenZeppelin's `initializer` modifier, guarding against being called twice. */
function hasManualOnceGuard(fn: { body: unknown }): boolean {
  let guarded = false;
  parser.visit(fn.body, {
    FunctionCall(node: FunctionCall) {
      const callee = node.expression as { type?: string; name?: string };
      if (callee.type !== "Identifier" || (callee.name !== "require" && callee.name !== "assert")) return;
      const firstArg = node.arguments[0] as UnaryOperation | undefined;
      if (firstArg?.type === "UnaryOperation" && firstArg.operator === "!") guarded = true;
    },
  });
  return guarded;
}

/**
 * Upgradeable (proxy-pattern) contracts can't rely on a constructor -
 * proxy storage is separate from the logic contract's own, so a
 * constructor there runs against the wrong storage entirely. The
 * standard fix is an `initialize()` function called once, right after
 * deployment - but if nothing stops it from being called a second time
 * (by anyone), an attacker can call it themselves and take over
 * ownership after the fact. This is exactly the bug class behind the
 * Wormhole and Audius proxy-takeover incidents.
 */
export const unprotectedInitializerDetector: Detector = {
  id: "unprotected-initializer",
  title: "Unguarded initializer function",
  severity: "critical",
  description: "An initialize()-style function assigns to state with no guard against being called more than once, letting anyone call it after deployment and take over.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];
    const stateVars = collectStateVariableNames(ctx.ast);

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body || !fn.name || !INITIALIZER_NAME_PATTERN.test(fn.name)) continue;
      if (hasModifierMatching(fn, INITIALIZER_GUARD_MODIFIER_PATTERN)) continue;
      if (hasManualOnceGuard(fn)) continue;

      let assignsState = false;
      parser.visit(fn.body, {
        BinaryOperation(node: { operator: string; left: { type?: string; name?: string } }) {
          if (node.operator !== "=") return;
          if (node.left.type === "Identifier" && node.left.name && stateVars.has(node.left.name)) assignsState = true;
        },
      });
      if (!assignsState) continue;

      findings.push({
        ruleId: unprotectedInitializerDetector.id,
        severity: unprotectedInitializerDetector.severity,
        line: nodeLine(fn),
        column: nodeColumn(fn),
        message: `${fn.name}(...) assigns to contract state with no guard against being called more than once.`,
        snippet: lineSnippet(ctx.sourceLines, nodeLine(fn)),
        fixSuggestion: "Guard with OpenZeppelin's `initializer` modifier, or a manual require(!initialized) that then sets initialized = true.",
      });
    }

    return findings;
  },
};
