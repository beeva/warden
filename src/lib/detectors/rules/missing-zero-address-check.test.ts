import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { missingZeroAddressCheckDetector } from "./missing-zero-address-check";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return missingZeroAddressCheckDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("missingZeroAddressCheckDetector", () => {
  it("flags a setter with no zero-address guard", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  address public owner;
  function setOwner(address newOwner) public {
    owner = newOwner;
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag a setter that guards against the zero address", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  address public owner;
  function setOwner(address newOwner) public {
    require(newOwner != address(0), "zero address");
    owner = newOwner;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a non-setter function that happens to take an address", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  mapping(address => uint256) public balanceOf;
  function balanceOfUser(address user) public view returns (uint256) {
    return balanceOf[user];
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
