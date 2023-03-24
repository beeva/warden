import parser from "@solidity-parser/parser";
import type { FunctionCall, FunctionDefinition, TypeName } from "@solidity-parser/parser/dist/src/ast-types";
import { collectFunctions, lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

/** true for a genuinely variable-length type - string, bytes (not bytes1..32, which are fixed-size), or a dynamic array (`T[]`, not `T[3]`). */
function isDynamicType(typeName: TypeName | null): boolean {
  if (!typeName) return false;
  if (typeName.type === "ElementaryTypeName") return typeName.name === "string" || typeName.name === "bytes";
  if (typeName.type === "ArrayTypeName") return typeName.length === null;
  return false;
}

function isEncodePackedCall(node: unknown): node is FunctionCall {
  const n = node as FunctionCall;
  if (n?.type !== "FunctionCall") return false;
  const callee = n.expression as { type?: string; expression?: { type?: string; name?: string }; memberName?: string };
  return callee.type === "MemberAccess" && callee.memberName === "encodePacked" && callee.expression?.type === "Identifier" && callee.expression?.name === "abi";
}

/**
 * SWC-133: `abi.encodePacked` concatenates its arguments with no
 * length-delimiting between them, unlike `abi.encode`. With two or more
 * variable-length arguments (string/bytes/a dynamic array), different
 * inputs can pack down to the exact same bytes - `encodePacked("a",
 * "bc")` and `encodePacked("ab", "c")` are identical - which breaks
 * anything that hashes the result and treats it as a unique identifier
 * for the inputs (a signature scheme, a dedup key, a Merkle leaf).
 * Scoped to a function's own parameters (whose types are known from the
 * signature) rather than every possible expression, to keep this a real
 * type check rather than a guess based on variable naming.
 */
export const hashCollisionEncodePackedDetector: Detector = {
  id: "hash-collision-encode-packed",
  title: "abi.encodePacked with 2+ dynamic-length arguments, hashed",
  severity: "medium",
  description: "abi.encodePacked concatenates arguments with no length delimiter - two or more variable-length arguments (string/bytes/dynamic array) can produce colliding output for different inputs.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    for (const { fn } of collectFunctions(ctx.ast)) {
      if (!fn.body) continue;
      const dynamicParams = new Set(
        (fn as FunctionDefinition).parameters.filter((p) => isDynamicType(p.typeName)).map((p) => p.name).filter((n): n is string => !!n)
      );
      if (dynamicParams.size < 2) continue;

      parser.visit(fn.body, {
        FunctionCall(node: FunctionCall) {
          const callee = node.expression as { type?: string; name?: string };
          if (callee.type !== "Identifier" || !["keccak256", "sha256", "sha3"].includes(callee.name ?? "")) return;

          const packedCall = node.arguments.find(isEncodePackedCall);
          if (!packedCall) return;

          const dynamicArgCount = packedCall.arguments.filter((arg) => {
            const a = arg as { type?: string; name?: string };
            return a.type === "Identifier" && a.name && dynamicParams.has(a.name);
          }).length;
          if (dynamicArgCount < 2) return;

          findings.push({
            ruleId: hashCollisionEncodePackedDetector.id,
            severity: hashCollisionEncodePackedDetector.severity,
            line: nodeLine(node),
            column: nodeColumn(node),
            message: `${callee.name}(abi.encodePacked(...)) here packs ${dynamicArgCount} variable-length parameters together - different inputs can hash identically.`,
            snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
            fixSuggestion: "Use abi.encode (which length-prefixes each argument) instead of abi.encodePacked when hashing more than one variable-length value.",
          });
        },
      });
    }

    return findings;
  },
};
