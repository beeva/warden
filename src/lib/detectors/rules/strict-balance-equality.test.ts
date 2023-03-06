import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { strictBalanceEqualityDetector } from "./strict-balance-equality";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return strictBalanceEqualityDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("strictBalanceEqualityDetector", () => {
  it("flags address(this).balance compared with ==", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function isFunded() public view returns (bool) {
    return address(this).balance == 1 ether;
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("flags a token balanceOf compared with !=", () => {
    const source = `
pragma solidity 0.8.24;
interface IERC20 { function balanceOf(address account) external view returns (uint256); }
contract C {
  IERC20 public token;
  function checkDrained() public view returns (bool) {
    return token.balanceOf(address(this)) != 0;
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag a >= comparison, which isn't broken by a forced extra balance", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function isFunded() public view returns (bool) {
    return address(this).balance >= 1 ether;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag an unrelated equality comparison", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function isOwner(address a, address b) public pure returns (bool) {
    return a == b;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
