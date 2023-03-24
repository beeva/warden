import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { hashCollisionEncodePackedDetector } from "./hash-collision-encode-packed";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return hashCollisionEncodePackedDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("hashCollisionEncodePackedDetector", () => {
  it("flags keccak256(abi.encodePacked(...)) with two string parameters", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function combine(string memory a, string memory b) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a, b));
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("flags two bytes parameters the same way", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function combine(bytes memory a, bytes memory b) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a, b));
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("flags a dynamic array combined with a string", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function combine(uint256[] memory a, string memory b) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a, b));
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag a single dynamic-type argument", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function hashOf(string memory a) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag two fixed-size arguments (uint256, address)", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function combine(uint256 a, address b) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a, b));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a fixed-length array (not dynamic-length)", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function combine(uint256[3] memory a, uint256 b) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a, b));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag abi.encode, which length-prefixes and has no collision risk", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function combine(string memory a, string memory b) public pure returns (bytes32) {
    return keccak256(abi.encode(a, b));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
