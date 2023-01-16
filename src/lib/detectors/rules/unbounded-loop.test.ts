import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { unboundedLoopDetector } from "./unbounded-loop";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return unboundedLoopDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("unboundedLoopDetector", () => {
  it("flags a loop over a dynamic array that transfers to each element", () => {
    const source = `
pragma solidity ^0.8.0;
contract Payout {
  address payable[] public recipients;
  function payAll() public {
    for (uint256 i = 0; i < recipients.length; i++) {
      recipients[i].transfer(1 ether);
    }
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag a loop bounded by a fixed constant", () => {
    const source = `
pragma solidity ^0.8.0;
contract Payout {
  address payable[] public recipients;
  function payFirstTen() public {
    for (uint256 i = 0; i < 10; i++) {
      recipients[i].transfer(1 ether);
    }
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a loop with no external call in its body", () => {
    const source = `
pragma solidity ^0.8.0;
contract Sum {
  uint256[] public values;
  function total() public view returns (uint256 sum) {
    for (uint256 i = 0; i < values.length; i++) {
      sum += values[i];
    }
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
