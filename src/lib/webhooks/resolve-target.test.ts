import { describe, expect, it } from "vitest";
import { resolvePullRequestTarget, resolvePushTarget } from "./resolve-target";

describe("resolvePushTarget", () => {
  it("extracts the branch name and commit SHA from a real-shaped push payload", () => {
    expect(resolvePushTarget({ ref: "refs/heads/main", after: "abc123" })).toEqual({ branch: "main", commitSha: "abc123" });
  });

  it("returns null for a payload missing required fields", () => {
    expect(resolvePushTarget({ ref: "refs/heads/main" })).toBeNull();
    expect(resolvePushTarget({})).toBeNull();
    expect(resolvePushTarget(null)).toBeNull();
  });
});

describe("resolvePullRequestTarget", () => {
  const payload = (action: string) => ({
    action,
    pull_request: { head: { ref: "feature/x", sha: "def456" } },
  });

  it("extracts the PR head branch and SHA for opened/synchronize/reopened", () => {
    expect(resolvePullRequestTarget(payload("opened"))).toEqual({ branch: "feature/x", commitSha: "def456" });
    expect(resolvePullRequestTarget(payload("synchronize"))).toEqual({ branch: "feature/x", commitSha: "def456" });
    expect(resolvePullRequestTarget(payload("reopened"))).toEqual({ branch: "feature/x", commitSha: "def456" });
  });

  it("returns null for actions that don't change the head commit", () => {
    expect(resolvePullRequestTarget(payload("closed"))).toBeNull();
    expect(resolvePullRequestTarget(payload("labeled"))).toBeNull();
    expect(resolvePullRequestTarget(payload("assigned"))).toBeNull();
  });

  it("returns null for a malformed payload", () => {
    expect(resolvePullRequestTarget({ action: "opened" })).toBeNull();
    expect(resolvePullRequestTarget(null)).toBeNull();
  });
});
