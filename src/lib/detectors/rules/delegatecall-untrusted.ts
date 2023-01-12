import parser from "@solidity-parser/parser";
import type { FunctionCall } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, isMemberCall, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

/**
 * SWC-112: `delegatecall` runs the target's code in the caller's own
 * storage context - if the target address comes from a function
 * parameter rather than a fixed, trusted address, a caller can point it
 * at arbitrary code that then has full read/write access to this
 * contract's storage layout. The canonical case: the Parity multisig
 * hack, where a library delegatecall'd to an attacker-controlled address.
 */
export const delegatecallUntrustedDetector: Detector = {
  id: "delegatecall-to-untrusted-target",
  title: "delegatecall to a caller-controlled address",
  severity: "critical",
  description: "delegatecall's target address is a function parameter, letting a caller run arbitrary code with this contract's own storage access.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;
      const paramNames = new Set(fn.parameters.map((p) => p.name).filter((n): n is string => !!n));
      if (paramNames.size === 0) continue;

      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall) {
          const match = isMemberCall(node, ["delegatecall"]);
          if (!match) return;
          const base = match.base as { type?: string; name?: string };
          if (base.type !== "Identifier" || !base.name || !paramNames.has(base.name)) return;

          findings.push({
            ruleId: delegatecallUntrustedDetector.id,
            severity: delegatecallUntrustedDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: `delegatecall's target ("${base.name}") is a function parameter - any caller chooses what code runs with this contract's storage.`,
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Restrict the delegatecall target to a fixed, trusted address (or an allowlist checked before the call), not a raw caller-supplied one.",
          });
        },
      });
    }

    return findings;
  },
};
