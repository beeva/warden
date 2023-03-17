import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { lockedEtherDetector } from "./locked-ether";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return lockedEtherDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("lockedEtherDetector", () => {
  it("flags a contract with receive() and no way to send ether back out", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  receive() external payable {}
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("flags a contract with a payable function and no withdraw path", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function deposit() public payable {}
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag when a separate function can send value back out", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function deposit() public payable {}
  function withdraw(address payable to, uint256 amount) public {
    to.transfer(amount);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a proxy-pattern contract - the delegatecall target's own logic could withdraw", () => {
    const source = `
pragma solidity 0.8.24;
contract Proxy {
  address public implementation;
  fallback() external payable {
    (bool ok, ) = implementation.delegatecall(msg.data);
    require(ok);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a contract that never accepts ether at all", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function noop() public pure returns (uint256) {
    return 1;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
