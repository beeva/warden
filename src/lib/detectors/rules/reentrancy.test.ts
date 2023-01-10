import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { reentrancyDetector } from "./reentrancy";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return reentrancyDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("reentrancyDetector", () => {
  it("flags a state write after an external call with no guard", () => {
    const source = `
pragma solidity ^0.8.0;
contract Vault {
  mapping(address => uint256) public balances;

  function withdraw() public {
    uint256 amount = balances[msg.sender];
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "transfer failed");
    balances[msg.sender] = 0;
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe("reentrancy-state-change-after-call");
    expect(findings[0]?.line).toBe(8);
  });

  it("does not flag when state is updated before the external call (checks-effects-interactions)", () => {
    const source = `
pragma solidity ^0.8.0;
contract Vault {
  mapping(address => uint256) public balances;

  function withdraw() public {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "transfer failed");
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag when the function carries a reentrancy guard modifier", () => {
    const source = `
pragma solidity ^0.8.0;
contract Vault {
  mapping(address => uint256) public balances;
  modifier nonReentrant() { _; }

  function withdraw() public nonReentrant {
    uint256 amount = balances[msg.sender];
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "transfer failed");
    balances[msg.sender] = 0;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a function with no external call at all", () => {
    const source = `
pragma solidity ^0.8.0;
contract Vault {
  mapping(address => uint256) public balances;
  function deposit() public payable {
    balances[msg.sender] += msg.value;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
