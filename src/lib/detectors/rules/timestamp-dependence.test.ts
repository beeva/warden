import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { timestampDependenceDetector } from "./timestamp-dependence";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return timestampDependenceDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("timestampDependenceDetector", () => {
  it("flags block.timestamp compared in a deadline check", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  uint256 deadline;
  function claim() public {
    require(block.timestamp < deadline, "expired");
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag unrelated comparisons", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  function check(uint256 a, uint256 b) public pure returns (bool) {
    return a < b;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
