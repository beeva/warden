import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { txOriginAuthDetector } from "./tx-origin-auth";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return txOriginAuthDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("txOriginAuthDetector", () => {
  it("flags tx.origin compared for an authorization check", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  address owner;
  function withdraw() public {
    require(tx.origin == owner, "not owner");
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe("tx-origin-authorization");
  });

  it("does not flag msg.sender used the same way", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  address owner;
  function withdraw() public {
    require(msg.sender == owner, "not owner");
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("flags the reversed comparison order (owner == tx.origin) too", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  address owner;
  function withdraw() public {
    require(owner == tx.origin, "not owner");
  }
}`;
    expect(run(source)).toHaveLength(1);
  });
});
