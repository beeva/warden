import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { unprotectedSelfdestructDetector } from "./unprotected-selfdestruct";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return unprotectedSelfdestructDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("unprotectedSelfdestructDetector", () => {
  it("flags selfdestruct reachable by anyone", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  function kill() public {
    selfdestruct(payable(msg.sender));
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("does not flag selfdestruct gated by an onlyOwner-style modifier", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  modifier onlyOwner() { _; }
  function kill() public onlyOwner {
    selfdestruct(payable(msg.sender));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag selfdestruct guarded by an explicit msg.sender require", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  address owner;
  function kill() public {
    require(msg.sender == owner, "not owner");
    selfdestruct(payable(owner));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
