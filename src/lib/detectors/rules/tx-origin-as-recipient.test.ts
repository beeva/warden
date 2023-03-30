import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { txOriginAsRecipientDetector } from "./tx-origin-as-recipient";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return txOriginAsRecipientDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("txOriginAsRecipientDetector", () => {
  it("flags tx.origin.transfer(...)", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function withdraw() public {
    tx.origin.transfer(1 ether);
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("flags tx.origin as an ERC20 transfer recipient", () => {
    const source = `
pragma solidity 0.8.24;
interface IERC20 { function transfer(address to, uint256 amount) external returns (bool); }
contract C {
  function payout(IERC20 token, uint256 amount) public {
    token.transfer(tx.origin, amount);
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag msg.sender used the same way", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function withdraw() public {
    payable(msg.sender).transfer(1 ether);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a token transfer to an unrelated address parameter", () => {
    const source = `
pragma solidity 0.8.24;
interface IERC20 { function transfer(address to, uint256 amount) external returns (bool); }
contract C {
  function payout(IERC20 token, address to, uint256 amount) public {
    token.transfer(to, amount);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
