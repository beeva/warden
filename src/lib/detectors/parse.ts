import parser from "@solidity-parser/parser";
import type { SourceUnit } from "@solidity-parser/parser/dist/src/ast-types";

export interface ParseResult {
  ast: SourceUnit | null;
  error: string | null;
}

/**
 * Parsing is deliberately non-tolerant: a contract that doesn't parse
 * can't be analyzed at all, and silently skipping it (rather than
 * surfacing a parse error as its own scan result) would be worse than
 * refusing - a file with a real syntax error is exactly the kind of file
 * a developer needs to know Warden couldn't check.
 */
export function parseSolidity(source: string): ParseResult {
  try {
    const ast = parser.parse(source, { loc: true, range: true }) as SourceUnit;
    return { ast, error: null };
  } catch (err) {
    if (err instanceof parser.ParserError) {
      const first = err.errors[0];
      const where = first ? ` at line ${first.line}, column ${first.column}` : "";
      return { ast: null, error: `${first?.message ?? err.message}${where}` };
    }
    return { ast: null, error: err instanceof Error ? err.message : String(err) };
  }
}
