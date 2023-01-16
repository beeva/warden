import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { floatingPragmaDetector } from "./floating-pragma";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return floatingPragmaDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("floatingPragmaDetector", () => {
  it("flags a caret-range pragma", () => {
    expect(run("pragma solidity ^0.8.0;\ncontract C {}")).toHaveLength(1);
  });

  it("flags a >= range pragma", () => {
    expect(run("pragma solidity >=0.8.0;\ncontract C {}")).toHaveLength(1);
  });

  it("does not flag a pinned exact version", () => {
    expect(run("pragma solidity 0.8.24;\ncontract C {}")).toHaveLength(0);
  });
});
