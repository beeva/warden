import { z } from "zod";
import { branchNameFromRef } from "./clone-and-scan";

export interface ScanTarget {
  branch: string;
  commitSha: string;
}

const pushPayloadSchema = z.object({
  ref: z.string(),
  after: z.string(),
});

// Only these actions represent new code on the PR's head worth
// re-scanning - "closed", "labeled", "assigned", etc. don't change what
// commit is sitting there, so scanning on every PR event would just
// waste a clone-and-scan on nothing new.
const PULL_REQUEST_TRIGGER_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

const pullRequestPayloadSchema = z.object({
  action: z.string(),
  pull_request: z.object({
    head: z.object({
      ref: z.string(),
      sha: z.string(),
    }),
  }),
});

export function resolvePushTarget(json: unknown): ScanTarget | null {
  const parsed = pushPayloadSchema.safeParse(json);
  if (!parsed.success) return null;
  return { branch: branchNameFromRef(parsed.data.ref), commitSha: parsed.data.after };
}

/** null both for a malformed payload and for a real pull_request event whose action isn't one that changed the head commit - callers can't (and don't need to) tell those two apart, since both mean "nothing to scan here." */
export function resolvePullRequestTarget(json: unknown): ScanTarget | null {
  const parsed = pullRequestPayloadSchema.safeParse(json);
  if (!parsed.success) return null;
  if (!PULL_REQUEST_TRIGGER_ACTIONS.has(parsed.data.action)) return null;
  return { branch: parsed.data.pull_request.head.ref, commitSha: parsed.data.pull_request.head.sha };
}
