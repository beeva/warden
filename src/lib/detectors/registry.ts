import { delegatecallUntrustedDetector } from "./rules/delegatecall-untrusted";
import { floatingPragmaDetector } from "./rules/floating-pragma";
import { missingZeroAddressCheckDetector } from "./rules/missing-zero-address-check";
import { reentrancyDetector } from "./rules/reentrancy";
import { timestampDependenceDetector } from "./rules/timestamp-dependence";
import { txOriginAuthDetector } from "./rules/tx-origin-auth";
import { unboundedLoopDetector } from "./rules/unbounded-loop";
import { uncheckedCallDetector } from "./rules/unchecked-call";
import { unprotectedSelfdestructDetector } from "./rules/unprotected-selfdestruct";
import { weakRandomnessDetector } from "./rules/weak-randomness";
import type { Detector } from "./types";

export const detectorRegistry: Detector[] = [
  reentrancyDetector,
  uncheckedCallDetector,
  txOriginAuthDetector,
  unprotectedSelfdestructDetector,
  delegatecallUntrustedDetector,
  timestampDependenceDetector,
  weakRandomnessDetector,
  floatingPragmaDetector,
  unboundedLoopDetector,
  missingZeroAddressCheckDetector,
];

export function getDetector(id: string): Detector | undefined {
  return detectorRegistry.find((d) => d.id === id);
}
