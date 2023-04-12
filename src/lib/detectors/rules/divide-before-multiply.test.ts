import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { divideBeforeMultiplyDetector } from "./divide-before-multiply";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return divideBeforeMultiplyDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("divideBeforeMultiplyDetector", () => {
  it("flags (a / b) * c", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function share(uint256 amount, uint256 total, uint256 weight) public pure returns (uint256) {
    return (amount / total) * weight;
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("flags a division on the right-hand side of a multiply too", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function share(uint256 amount, uint256 total, uint256 weight) public pure returns (uint256) {
    return weight * (amount / total);
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag the already-correct multiply-then-divide order", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function share(uint256 amount, uint256 total, uint256 weight) public pure returns (uint256) {
    return (amount * weight) / total;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a division with no surrounding multiplication", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function half(uint256 amount) public pure returns (uint256) {
    return amount / 2;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a plain multiplication with no division involved", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function scale(uint256 amount, uint256 factor) public pure returns (uint256) {
    return amount * factor;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("flags every division-before-multiply occurrence in a chain", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function compound(uint256 a, uint256 b, uint256 c, uint256 d) public pure returns (uint256) {
    return (a / b) * c * (d / b);
  }
}`;
    expect(run(source)).toHaveLength(2);
  });
});
