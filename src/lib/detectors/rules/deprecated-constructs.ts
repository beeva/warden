import parser from "@solidity-parser/parser";
import type { FunctionCall, MemberAccess, ThrowStatement } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

/**
 * A grab-bag of language constructs the Solidity compiler team has
 * explicitly deprecated - each one still parses and (on an old enough
 * compiler) compiles, but signals code that predates a safety
 * improvement the language itself made: `throw` burned all remaining gas
 * instead of refunding it (replaced by revert/require), `sha3` was
 * renamed to keccak256 for clarity about which hash it actually is, and
 * `callcode` preserved msg.sender/msg.value incorrectly compared to
 * delegatecall, which is why it was deprecated in its favor.
 */
export const deprecatedConstructsDetector: Detector = {
  id: "deprecated-language-construct",
  title: "Deprecated language construct",
  severity: "low",
  description: "Uses a Solidity construct (throw / sha3 / callcode) that has been deprecated in favor of a safer or clearer replacement.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      ThrowStatement(node: ThrowStatement) {
        findings.push({
          ruleId: deprecatedConstructsDetector.id,
          severity: deprecatedConstructsDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: "throw is deprecated - unlike revert()/require(), it consumes all remaining gas instead of refunding it.",
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: 'Replace with revert("reason") or require(condition, "reason").',
        });
      },
      FunctionCall(node: FunctionCall) {
        const callee = node.expression as { type?: string; name?: string };
        if (callee.type === "Identifier" && callee.name === "sha3") {
          findings.push({
            ruleId: deprecatedConstructsDetector.id,
            severity: deprecatedConstructsDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: "sha3 is a deprecated alias for keccak256 - functionally identical, but the name invites confusion with SHA-3 (Keccak's NIST-standardized variant, which uses different padding).",
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Use keccak256(...) instead.",
          });
        }
      },
      MemberAccess(node: MemberAccess) {
        if (node.memberName !== "callcode") return;
        findings.push({
          ruleId: deprecatedConstructsDetector.id,
          severity: deprecatedConstructsDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: "callcode is deprecated in favor of delegatecall - callcode gets msg.sender/msg.value wrong in a way delegatecall fixed.",
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: "Use delegatecall instead, with the same caution about who controls the target address.",
        });
      },
    });

    return findings;
  },
};
