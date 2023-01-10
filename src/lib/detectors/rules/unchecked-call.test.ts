import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { uncheckedCallDetector } from "./unchecked-call";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return uncheckedCallDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("uncheckedCallDetector", () => {
  it("flags a bare .call(...) whose return value is discarded", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  function pay(address payable to) public {
    to.call{value: 1 ether}("");
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(".call(...)");
  });

  it("does not flag a call whose result is captured and checked", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  function pay(address payable to) public {
    (bool ok, ) = to.call{value: 1 ether}("");
    require(ok);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag .transfer, which reverts on failure by itself", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  function pay(address payable to) public {
    to.transfer(1 ether);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("flags delegatecall and staticcall the same way", () => {
    const source = `
pragma solidity ^0.8.0;
contract C {
  function proxy(address target, bytes memory data) public {
    target.delegatecall(data);
    target.staticcall(data);
  }
}`;
    expect(run(source)).toHaveLength(2);
  });
});
