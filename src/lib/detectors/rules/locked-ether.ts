import parser from "@solidity-parser/parser";
import type { ContractDefinition, FunctionCall, FunctionDefinition } from "@solidity-parser/parser/dist/src/ast-types";
import { isMemberCall, nodeColumn, nodeLine } from "../ast-utils";
import type { Detector, DetectorContext, RawFinding } from "../types";

const VALUE_SEND_MEMBERS = ["transfer", "send", "call"];

function acceptsEther(fn: FunctionDefinition): boolean {
  return fn.isReceiveEther || fn.stateMutability === "payable";
}

function sendsValue(fn: FunctionDefinition): boolean {
  if (!fn.body) return false;
  let found = false;
  parser.visit(fn.body, {
    FunctionCall(node: FunctionCall) {
      if (isMemberCall(node, VALUE_SEND_MEMBERS)) found = true;
    },
  });
  return found;
}

// A proxy-pattern contract (a payable fallback that delegatecalls to an
// implementation address) delegates its entire logic - including
// whatever withdraw path exists - to a contract this scanner can't see
// from this file alone. Found live: fixtures/safe/fixed-proxy.sol (a
// legitimate, common pattern) was flagged as locked-ether before this
// exclusion existed, which would make this a standing false positive on
// every proxy contract in a real codebase.
function delegatesElsewhere(fn: FunctionDefinition): boolean {
  if (!fn.body) return false;
  let found = false;
  parser.visit(fn.body, {
    FunctionCall(node: FunctionCall) {
      if (isMemberCall(node, ["delegatecall"])) found = true;
    },
  });
  return found;
}

/**
 * A contract with a `receive()`/payable fallback or any payable function
 * can accumulate ether, but if nothing anywhere in the contract ever
 * calls `.transfer`/`.send`/`.call{value:...}`, there's no path for that
 * ether to leave again - it's permanently locked behind whatever the
 * contract's own logic allows, which in this case is nothing. This is a
 * whole-contract check (not per-function) since the sender and the
 * spender are often different functions entirely.
 */
export const lockedEtherDetector: Detector = {
  id: "locked-ether",
  title: "Contract can receive ether but has no way to send it back out",
  severity: "medium",
  description: "A payable function or receive() accepts ether, but no function anywhere in the contract ever transfers/sends/calls with value - anything sent in may be permanently stuck.",
  run(ctx: DetectorContext): RawFinding[] {
    const findings: RawFinding[] = [];

    parser.visit(ctx.ast, {
      ContractDefinition(contract: ContractDefinition) {
        const functions = contract.subNodes.filter((n): n is FunctionDefinition => n.type === "FunctionDefinition");
        const receiver = functions.find(acceptsEther);
        if (!receiver) return;
        if (functions.some(sendsValue)) return;
        if (functions.some(delegatesElsewhere)) return;

        findings.push({
          ruleId: lockedEtherDetector.id,
          severity: lockedEtherDetector.severity,
          line: nodeLine(contract),
          column: nodeColumn(contract),
          message: `${contract.name} can receive ether (${receiver.isReceiveEther ? "receive()" : (receiver.name ?? "a payable function")}) but has no function that ever sends value back out.`,
          snippet: `contract ${contract.name} { ... }`,
          fixSuggestion: "Add a withdraw function (owner-only or per-depositor), or remove payable if this contract was never meant to hold ether.",
        });
      },
    });

    return findings;
  },
};
