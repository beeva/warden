import parser from "@solidity-parser/parser";
import type { FunctionCall, MemberAccess } from "@solidity-parser/parser/dist/src/ast-types";
import { lineSnippet, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const HASH_FUNCTIONS = ["keccak256", "sha3", "sha256"];
const BLOCK_ENTROPY_MEMBERS = new Set(["timestamp", "difficulty", "prevrandao", "number", "coinbase"]);

function referencesBlockEntropy(node: unknown): boolean {
  let found = false;
  parser.visit(node, {
    MemberAccess(n: MemberAccess) {
      const base = n.expression as { type?: string; name?: string };
      if (base.type === "Identifier" && base.name === "block" && BLOCK_ENTROPY_MEMBERS.has(n.memberName)) found = true;
    },
    Identifier(n: { name: string }) {
      if (n.name === "blockhash") found = true;
    },
  });
  return found;
}

/**
 * SWC-120: block properties (timestamp, difficulty/prevrandao, blockhash,
 * the coinbase address) are all known to - or influenceable by - the
 * block's own producer before the block is finalized. Hashing them
 * together and treating the result as unpredictable randomness (a common
 * pattern for on-chain lotteries/loot drops) means the producer can bias
 * or predict the outcome.
 */
export const weakRandomnessDetector: Detector = {
  id: "weak-randomness-source",
  title: "Predictable on-chain randomness source",
  severity: "high",
  description: "A hash of block-derived values (timestamp/difficulty/blockhash/coinbase) is used as a randomness source - block producers can influence or predict these.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      FunctionCall(node: FunctionCall) {
        const callee = node.expression as { type?: string; name?: string };
        if (callee.type !== "Identifier" || !callee.name || !HASH_FUNCTIONS.includes(callee.name)) return;
        if (!node.arguments.some((arg) => referencesBlockEntropy(arg))) return;

        findings.push({
          ruleId: weakRandomnessDetector.id,
          severity: weakRandomnessDetector.severity,
          line: nodeLine(node),
          column: nodeColumn(node),
          message: `${callee.name}(...) is seeded with a block-derived value here, which a block producer can influence or predict ahead of finalization.`,
          snippet: lineSnippet(ctx.sourceLines, nodeLine(node)),
          fixSuggestion: "Use a verifiable randomness source (e.g. Chainlink VRF) instead of deriving randomness from block properties.",
        });
      },
    });

    return findings;
  },
};
