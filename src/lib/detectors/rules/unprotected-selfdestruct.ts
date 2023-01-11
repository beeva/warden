import parser from "@solidity-parser/parser";
import type { FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, hasModifierMatching, isIdentifierCall, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const SELFDESTRUCT_NAMES = ["selfdestruct", "suicide"];
const ACCESS_MODIFIER_PATTERN = /only\w*owner|only\w*admin|onlygovernance|auth/i;

function bodyGuardsOnMsgSender(fn: { body: unknown }): boolean {
  let guarded = false;
  parser.visit(fn.body, {
    FunctionCall(node: FunctionCall) {
      const callee = node.expression as { type?: string; name?: string };
      if (callee.type !== "Identifier" || (callee.name !== "require" && callee.name !== "assert")) return;
      const serialized = JSON.stringify(node.arguments);
      if (serialized.includes('"msg"') && serialized.includes('"sender"')) guarded = true;
    },
  });
  return guarded;
}

/**
 * SWC-106: `selfdestruct` sends the contract's entire balance to a target
 * and wipes its code - if any code path can reach it without an
 * access-control check, anyone can permanently brick the contract (the
 * canonical case: Parity's frozen multisig wallet library).
 */
export const unprotectedSelfdestructDetector: Detector = {
  id: "unprotected-selfdestruct",
  title: "Unprotected selfdestruct",
  severity: "critical",
  description: "selfdestruct is reachable without an access-control modifier or an explicit msg.sender check, so any caller can destroy the contract.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;
      if (hasModifierMatching(fn, ACCESS_MODIFIER_PATTERN)) continue;
      if (bodyGuardsOnMsgSender(fn)) continue;

      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall) {
          if (!isIdentifierCall(node, SELFDESTRUCT_NAMES)) return;

          findings.push({
            ruleId: unprotectedSelfdestructDetector.id,
            severity: unprotectedSelfdestructDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: `${fn.name ?? "this function"} reaches selfdestruct with no access-control modifier or msg.sender check.`,
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Gate this function with an owner-only modifier (or an explicit require(msg.sender == owner)) before it can be reached.",
          });
        },
      });
    }

    return findings;
  },
};
