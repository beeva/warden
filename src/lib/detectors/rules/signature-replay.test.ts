import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { signatureReplayDetector } from "./signature-replay";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return signatureReplayDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("signatureReplayDetector", () => {
  it("flags ecrecover with no apparent nonce or used-signature tracking", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function withdraw(uint256 amount, bytes32 r, bytes32 s, uint8 v) public {
    address signer = ecrecover(keccak256(abi.encodePacked(amount)), v, r, s);
    require(signer != address(0), "bad signature");
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("does not flag when a used-signature mapping is referenced", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  mapping(bytes32 => bool) public used;
  function withdraw(uint256 amount, bytes32 hash, bytes32 r, bytes32 s, uint8 v) public {
    require(!used[hash], "replayed");
    address signer = ecrecover(hash, v, r, s);
    require(signer != address(0), "bad signature");
    used[hash] = true;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag when a nonce is referenced", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  mapping(address => uint256) public nonces;
  function withdraw(uint256 nonce, bytes32 hash, bytes32 r, bytes32 s, uint8 v) public {
    require(nonce == nonces[msg.sender], "bad nonce");
    address signer = ecrecover(hash, v, r, s);
    require(signer != address(0), "bad signature");
    nonces[msg.sender]++;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a function that never calls ecrecover", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function hashOf(uint256 a) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(a));
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
