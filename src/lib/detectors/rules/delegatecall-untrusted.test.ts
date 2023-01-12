import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { delegatecallUntrustedDetector } from "./delegatecall-untrusted";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return delegatecallUntrustedDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("delegatecallUntrustedDetector", () => {
  it("flags delegatecall to a function parameter", () => {
    const source = `
pragma solidity ^0.8.0;
contract Proxy {
  function forward(address target, bytes memory data) public {
    target.delegatecall(data);
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag delegatecall to a fixed state-variable address", () => {
    const source = `
pragma solidity ^0.8.0;
contract Proxy {
  address public implementation;
  function forward(bytes memory data) public {
    implementation.delegatecall(data);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
