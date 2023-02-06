import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { uncheckedErc20TransferDetector } from "./unchecked-erc20-transfer";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return uncheckedErc20TransferDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("uncheckedErc20TransferDetector", () => {
  it("flags a bare token.transfer(to, amount)", () => {
    const source = `
pragma solidity 0.8.24;
interface IERC20 { function transfer(address to, uint256 amount) external returns (bool); }
contract C {
  function pay(IERC20 token, address to, uint256 amount) public {
    token.transfer(to, amount);
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("flags a bare token.transferFrom(from, to, amount)", () => {
    const source = `
pragma solidity 0.8.24;
interface IERC20 { function transferFrom(address from, address to, uint256 amount) external returns (bool); }
contract C {
  function pull(IERC20 token, address from, address to, uint256 amount) public {
    token.transferFrom(from, to, amount);
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag a checked transfer", () => {
    const source = `
pragma solidity 0.8.24;
interface IERC20 { function transfer(address to, uint256 amount) external returns (bool); }
contract C {
  function pay(IERC20 token, address to, uint256 amount) public {
    require(token.transfer(to, amount), "transfer failed");
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag address.transfer(amount), a different one-argument built-in", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function pay(address payable to) public {
    to.transfer(1 ether);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
