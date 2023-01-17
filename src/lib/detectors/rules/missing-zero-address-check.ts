import parser from "@solidity-parser/parser";
import type { BinaryOperation, FunctionCall, FunctionDefinition } from "@solidity-parser/parser/dist/src/ast-types";
import { collectStateVariableNames, collectFunctions, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const SETTER_NAME_PATTERN = /^(set|change|update|transfer)/i;

function checksAgainstZeroAddress(fn: FunctionDefinition, paramName: string): boolean {
  if (!fn.body) return false;
  let checked = false;
  parser.visit(fn.body, {
    FunctionCall(node: FunctionCall) {
      const callee = node.expression as { type?: string; name?: string };
      if (callee.type !== "Identifier" || (callee.name !== "require" && callee.name !== "assert")) return;
      // `address(0)` parses as a FunctionCall to the Identifier "address"
      // with a single NumberLiteral "0" argument, not the literal text
      // "address(0)" - matched structurally via its serialized shape
      // rather than reconstructing source text from the AST.
      const serialized = JSON.stringify(node.arguments);
      if (serialized.includes(`"name":"${paramName}"`) && serialized.includes('"name":"address"') && serialized.includes('"number":"0"')) {
        checked = true;
      }
    },
  });
  return checked;
}

/**
 * A single-address-parameter setter (setOwner, changeAdmin, ...) that
 * assigns straight into a state variable with no zero-address check can
 * be called with `address(0)` - depending on what the variable controls,
 * that can permanently lock the contract out of that role (there's no
 * private key for the zero address to call back in and fix it).
 */
export const missingZeroAddressCheckDetector: Detector = {
  id: "missing-zero-address-check",
  title: "Setter accepts the zero address unchecked",
  severity: "low",
  description: "An address-setting function has no require(param != address(0)) guard - assigning the zero address can permanently disable whatever role that variable controls.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];
    const stateVars = collectStateVariableNames(ctx.ast);

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body || !fn.name || !SETTER_NAME_PATTERN.test(fn.name)) continue;

      const addressParams = fn.parameters.filter((p) => {
        const typeName = p.typeName as { type?: string; name?: string } | null;
        return typeName?.type === "ElementaryTypeName" && typeName.name?.startsWith("address") && p.name;
      });
      if (addressParams.length === 0) continue;

      for (const param of addressParams) {
        const paramName = param.name as string;
        let assignsToState = false;
        parser.visit(fn.body, {
          BinaryOperation(node: BinaryOperation) {
            if (node.operator !== "=") return;
            const left = node.left as { type?: string; name?: string };
            const right = node.right as { type?: string; name?: string };
            if (left.type === "Identifier" && left.name && stateVars.has(left.name) && right.type === "Identifier" && right.name === paramName) {
              assignsToState = true;
            }
          },
        });
        if (!assignsToState || checksAgainstZeroAddress(fn, paramName)) continue;

        findings.push({
          ruleId: missingZeroAddressCheckDetector.id,
          severity: missingZeroAddressCheckDetector.severity,
          line: nodeLine(fn),
          column: nodeColumn(fn),
          message: `${fn.name}(...) assigns "${paramName}" into state with no check against address(0).`,
          snippet: lineSnippet(ctx.sourceLines, nodeLine(fn)),
          fixSuggestion: `Add require(${paramName} != address(0), "zero address") before the assignment.`,
        });
      }
    }

    return findings;
  },
};
