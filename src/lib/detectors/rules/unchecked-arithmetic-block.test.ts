import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { uncheckedArithmeticBlockDetector } from "./unchecked-arithmetic-block";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return uncheckedArithmeticBlockDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("uncheckedArithmeticBlockDetector", () => {
  it("flags a compound subtraction (-=) inside an unchecked block", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  mapping(address => uint256) public balances;
  function withdraw(uint256 amount) external {
    unchecked {
      balances[msg.sender] -= amount;
    }
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
  });

  it("flags a plain subtraction assignment inside an unchecked block", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  mapping(address => uint256) public balances;
  function withdraw(uint256 amount) external {
    unchecked {
      balances[msg.sender] = balances[msg.sender] - amount;
    }
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("flags a decrement inside an unchecked block", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  uint256 public supply;
  function burn() external {
    unchecked {
      supply--;
    }
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag an increment inside an unchecked block (the common gas-saving loop counter idiom)", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function sumTo(uint256 n) public pure returns (uint256 total) {
    for (uint256 i = 0; i < n;) {
      total += i;
      unchecked { i++; }
    }
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a subtraction outside any unchecked block", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  mapping(address => uint256) public balances;
  function withdraw(uint256 amount) external {
    balances[msg.sender] -= amount;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("flags every risky subtraction in a block with more than one", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  uint256 public a;
  uint256 public b;
  function drain(uint256 x, uint256 y) external {
    unchecked {
      a -= x;
      b -= y;
    }
  }
}`;
    expect(run(source)).toHaveLength(2);
  });
});
