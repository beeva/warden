import { describe, expect, it } from "vitest";
import { parseSolidity } from "../parse";
import { msgValueInLoopDetector } from "./msg-value-in-loop";

function run(source: string) {
  const { ast, error } = parseSolidity(source);
  if (!ast) throw new Error(`fixture failed to parse: ${error}`);
  return msgValueInLoopDetector.run({ ast, sourceLines: source.split("\n"), filePath: "fixture.sol" });
}

describe("msgValueInLoopDetector", () => {
  it("flags msg.value read inside a for loop", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function distribute(address[] memory recipients) public payable {
    for (uint256 i = 0; i < recipients.length; i++) {
      payable(recipients[i]).transfer(msg.value);
    }
  }
}`;
    const findings = run(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("flags msg.value read inside a while loop", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function distribute(address[] memory recipients) public payable {
    uint256 i = 0;
    while (i < recipients.length) {
      payable(recipients[i]).transfer(msg.value);
      i++;
    }
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("flags msg.value read inside a do-while loop", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function distribute(address[] memory recipients) public payable {
    uint256 i = 0;
    do {
      payable(recipients[i]).transfer(msg.value);
      i++;
    } while (i < recipients.length);
  }
}`;
    expect(run(source)).toHaveLength(1);
  });

  it("does not flag msg.value computed once before the loop", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function distribute(address[] memory recipients) public payable {
    uint256 share = msg.value / recipients.length;
    for (uint256 i = 0; i < recipients.length; i++) {
      payable(recipients[i]).transfer(share);
    }
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag an unrelated member access named value on a different base", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  struct Item { uint256 value; }
  function sumAll(Item[] memory items) public pure returns (uint256 total) {
    for (uint256 i = 0; i < items.length; i++) {
      total += items[i].value;
    }
  }
}`;
    expect(run(source)).toHaveLength(0);
  });

  it("does not flag msg.value outside any loop", () => {
    const source = `
pragma solidity 0.8.24;
contract C {
  function deposit() public payable returns (uint256) {
    return msg.value;
  }
}`;
    expect(run(source)).toHaveLength(0);
  });
});
