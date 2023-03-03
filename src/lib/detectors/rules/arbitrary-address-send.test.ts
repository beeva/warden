import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { arbitraryAddressSendDetector } from "./arbitrary-address-send";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return arbitraryAddressSendDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("arbitraryAddressSendDetector", () => {
  it("flags a public function that sends value to a caller-supplied address with no guard", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function drain(address payable to) public {
    to.transfer(address(this).balance);
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("does not flag when the function has an onlyOwner-style modifier", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  modifier onlyOwner() { _; }
  function withdraw(address payable to) public onlyOwner {
    to.transfer(address(this).balance);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag when the function guards on msg.sender directly", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  address owner;
  function withdraw(address payable to) public {
    require(msg.sender == owner, "not owner");
    to.transfer(address(this).balance);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag a value send to a fixed state-variable address", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  address payable public treasury;
  function sweep() public {
    treasury.transfer(address(this).balance);
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
