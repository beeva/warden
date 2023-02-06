import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { deprecatedConstructsDetector } from "./deprecated-constructs";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return deprecatedConstructsDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("deprecatedConstructsDetector", () => {
  it("flags throw", () => {
    const source = `
pragma solidity ^0.4.24;
contract C {
  function f() public {
    if (msg.sender == address(0)) throw;
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("throw");
  });

  it("flags sha3", () => {
    const source = `
pragma solidity ^0.4.24;
contract C {
  function f() public pure returns (bytes32) {
    return sha3("x");
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("flags callcode", () => {
    const source = `
pragma solidity ^0.4.24;
contract C {
  function f(address target) public {
    target.callcode(bytes4(keccak256("f()")));
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag modern equivalents", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function f() public pure returns (bytes32) {
    return keccak256("x");
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
