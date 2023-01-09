import parser from "@solidity-parser/parser";
import type {
  ASTNode,
  BaseASTNode,
  ContractDefinition,
  FunctionDefinition,
  SourceUnit,
} from "@solidity-parser/parser/dist/src/ast-types";

/** Every FunctionDefinition in the source, paired with the contract that declares it (free functions outside a contract have `contractName: null`). */
export function collectFunctions(ast: SourceUnit): { contractName: string | null; fn: FunctionDefinition }[] {
  const results: { contractName: string | null; fn: FunctionDefinition }[] = [];
  parser.visit(ast, {
    ContractDefinition(contract: ContractDefinition) {
      for (const sub of contract.subNodes) {
        if (sub.type === "FunctionDefinition") {
          results.push({ contractName: contract.name, fn: sub as FunctionDefinition });
        }
      }
    },
  });
  return results;
}

/** Every state variable name declared at contract scope - used to tell a storage write apart from a local/memory one. */
export function collectStateVariableNames(ast: SourceUnit): Set<string> {
  const names = new Set<string>();
  parser.visit(ast, {
    StateVariableDeclaration(node: { variables: { name: string | null }[] }) {
      for (const v of node.variables) {
        if (v.name) names.add(v.name);
      }
    },
  });
  return names;
}

/** Modifier names a function is decorated with, e.g. ["onlyOwner", "nonReentrant"]. */
export function modifierNames(fn: FunctionDefinition): string[] {
  return fn.modifiers.map((m) => m.name);
}

export function hasModifierMatching(fn: FunctionDefinition, pattern: RegExp): boolean {
  return modifierNames(fn).some((name) => pattern.test(name));
}

export function nodeLine(node: BaseASTNode | ASTNode | null | undefined): number {
  return (node as BaseASTNode | undefined)?.loc?.start.line ?? 0;
}

export function nodeColumn(node: BaseASTNode | ASTNode | null | undefined): number {
  return ((node as BaseASTNode | undefined)?.loc?.start.column ?? 0) + 1;
}

export function lineSnippet(sourceLines: string[], line: number): string {
  return (sourceLines[line - 1] ?? "").trim();
}

/**
 * True if `call.expression` is `<something>.<memberName>` for one of the
 * given member names - e.g. matching `x.call(...)`, `x.delegatecall(...)`.
 * A call with an options block, `x.call{value: v}(...)`, wraps the real
 * MemberAccess in a NameValueExpression rather than exposing it directly
 * as `call.expression` - unwrapped here so both forms match identically.
 */
export function isMemberCall(
  call: { expression: BaseASTNode },
  memberNames: string[]
): { base: BaseASTNode; memberName: string } | null {
  let expr = call.expression as BaseASTNode & { expression?: BaseASTNode; memberName?: string; type: string };
  if (expr.type === "NameValueExpression" && expr.expression) {
    expr = expr.expression as typeof expr;
  }
  if (expr.type !== "MemberAccess" || !expr.memberName) return null;
  if (!memberNames.includes(expr.memberName)) return null;
  return { base: expr.expression as BaseASTNode, memberName: expr.memberName };
}

/** True if `expr` is the bare identifier `name` (e.g. matching a call to a free function like `selfdestruct(...)`). */
export function isIdentifierCall(call: { expression: BaseASTNode }, names: string[]): boolean {
  const expr = call.expression as BaseASTNode & { name?: string };
  return expr.type === "Identifier" && !!expr.name && names.includes(expr.name);
}
