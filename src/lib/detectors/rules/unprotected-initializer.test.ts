import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { unprotectedInitializerDetector } from "./unprotected-initializer";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return unprotectedInitializerDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("unprotectedInitializerDetector", () => {
  it("flags an initialize() with no guard against being called twice", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  address public owner;
  function initialize(address _owner) public {
    owner = _owner;
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("does not flag one guarded by an initializer modifier", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  address public owner;
  bool private initialized;
  modifier initializer() { require(!initialized); initialized = true; _; }
  function initialize(address _owner) public initializer {
    owner = _owner;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag one with a manual require(!initialized) guard in its own body", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  address public owner;
  bool private initialized;
  function initialize(address _owner) public {
    require(!initialized, "already initialized");
    initialized = true;
    owner = _owner;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a function named initialize that never writes to state", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function initializeView() public pure returns (uint256) {
    return 1;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
