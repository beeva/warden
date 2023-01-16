import parser from "@solidity-parser/parser";
import type { PragmaDirective } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

/**
 * SWC-103: a pragma like `^0.8.0` or `>=0.8.0` lets the contract compile
 * with any matching future compiler version - fine for a library meant to
 * be reused broadly, but a deployed contract's actual bytecode depends on
 * exactly which compiler version built it. An unpinned pragma means a
 * later compile (a redeploy, a fork, someone else building the repo) can
 * silently pick up a different compiler with different codegen or a
 * changed default behavior.
 */
export const floatingPragmaDetector: Detector = {
  id: "floating-pragma",
  title: "Unpinned compiler version",
  severity: "info",
  description: "The solidity pragma allows a range of compiler versions rather than pinning to one exact version.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      PragmaDirective(node: PragmaDirective) {
        if (node.name !== "solidity") return;
        const value = node.value.trim();
        if (!value.startsWith("^") && !value.startsWith(">") && !value.startsWith("<") && !value.includes(" ")) return;

        findings.push({
          ruleId: floatingPragmaDetector.id,
          severity: floatingPragmaDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: `pragma solidity ${value} allows more than one compiler version to build this contract.`,
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: 'Pin to one exact version for a deployed contract, e.g. `pragma solidity 0.8.24;`.',
        });
      },
    });

    return findings;
  },
};
