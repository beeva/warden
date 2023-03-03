import parser from "@solidity-parser/parser";
import type { FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, hasModifierMatching, isMemberCall, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const VALUE_SEND_MEMBERS = ["call", "transfer", "send"];
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
 * SWC-105-adjacent: a function with no access-control guard that sends
 * value to an address taken straight from its own parameters lets any
 * caller name themselves (or anyone else) as the recipient and drain
 * whatever this function can move - the destination isn't even the
 * caller's own address by convention, it's whatever address they pass.
 */
export const arbitraryAddressSendDetector: Detector = {
  id: "arbitrary-address-send",
  title: "Sends value to a caller-supplied address with no access control",
  severity: "critical",
  description: "A function with no access-control guard sends value (.call/.transfer/.send) to an address taken directly from its own parameters.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;
      if (fn.visibility !== "public" && fn.visibility !== "external" && fn.visibility !== "default") continue;
      if (hasModifierMatching(fn, ACCESS_MODIFIER_PATTERN)) continue;
      if (bodyGuardsOnMsgSender(fn)) continue;

      const addressParamNames = new Set(
        fn.parameters
          .filter((p) => {
            const typeName = p.typeName as { type?: string; name?: string } | null;
            return typeName?.type === "ElementaryTypeName" && typeName.name?.startsWith("address");
          })
          .map((p) => p.name)
          .filter((n): n is string => !!n)
      );
      if (addressParamNames.size === 0) continue;

      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall) {
          const match = isMemberCall(node, VALUE_SEND_MEMBERS);
          if (!match) return;
          const base = match.base as { type?: string; name?: string };
          if (base.type !== "Identifier" || !base.name || !addressParamNames.has(base.name)) return;

          findings.push({
            ruleId: arbitraryAddressSendDetector.id,
            severity: arbitraryAddressSendDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: `${fn.name ?? "this function"} sends value to "${base.name}", a caller-supplied address, with no access-control guard on the function itself.`,
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Restrict who can call this function (an owner-only modifier, or an explicit require(msg.sender == ...)), or restrict the destination to the caller's own address.",
          });
        },
      });
    }

    return findings;
  },
};
