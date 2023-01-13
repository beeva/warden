import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { weakRandomnessDetector } from "./weak-randomness";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return weakRandomnessDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("weakRandomnessDetector", () => {
  it("flags keccak256 of block.timestamp used as a randomness source", () => {
    const source = `
pragma solidity ^0.8.0;
contract Lottery {
  function pickWinner(address[] memory players) public view returns (address) {
    uint256 index = uint256(keccak256(abi.encodePacked(block.timestamp))) % players.length;
    return players[index];
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("flags blockhash-derived randomness too", () => {
    const source = `
pragma solidity ^0.8.0;
contract Lottery {
  function seed() public view returns (bytes32) {
    return keccak256(abi.encodePacked(blockhash(block.number - 1)));
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag a hash of ordinary, non-block-derived inputs", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  function hashOf(uint256 a, uint256 b) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a, b));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
