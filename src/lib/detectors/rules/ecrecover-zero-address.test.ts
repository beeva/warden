import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { ecrecoverZeroAddressDetector } from "./ecrecover-zero-address";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return ecrecoverZeroAddressDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("ecrecoverZeroAddressDetector", () => {
  it("flags ecrecover whose result is never checked against address(0)", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function verify(bytes32 h, uint8 v, bytes32 r, bytes32 s, address owner) public pure returns (bool) {
    address signer = ecrecover(h, v, r, s);
    return signer == owner;
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
  });

  it("does not flag when the function checks the result against address(0)", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function verify(bytes32 h, uint8 v, bytes32 r, bytes32 s, address owner) public pure returns (bool) {
    address signer = ecrecover(h, v, r, s);
    require(signer != address(0), "invalid signature");
    return signer == owner;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a function that never calls ecrecover", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function hashOf(uint256 a) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
