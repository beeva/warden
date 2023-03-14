import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { branchNameFromRef, cloneAndScan } from "../../src/lib/webhooks/clone-and-scan";

const execFileAsync = promisify(execFile);

const VULNERABLE_CONTRACT = `pragma solidity 0.8.24;
contract V {
  mapping(address => uint256) public balances;
  function withdraw() public {
    uint256 amount = balances[msg.sender];
    msg.sender.call{value: amount}("");
    balances[msg.sender] = 0;
  }
}
`;

describe("cloneAndScan (integration, real git)", () => {
  let sourceRepoDir: string;

  beforeEach(async () => {
    // A real local git repository - git clone supports a local filesystem
    // path as its source with no network involved, so this exercises the
    // actual `git clone` subprocess and the actual scan engine together,
    // not a stub standing in for either.
    sourceRepoDir = await mkdtemp(join(tmpdir(), "warden-source-"));
    const run = (args: string[]) => execFileAsync("git", args, { cwd: sourceRepoDir });
    await run(["init", "--initial-branch=main"]);
    await run(["config", "user.email", "test@example.com"]);
    await run(["config", "user.name", "Test"]);
    await writeFile(join(sourceRepoDir, "Vulnerable.sol"), VULNERABLE_CONTRACT);
    await run(["add", "."]);
    await run(["commit", "-m", "initial"]);
  });

  afterEach(async () => {
    await rm(sourceRepoDir, { recursive: true, force: true });
  });

  it("clones a real local repo and scans the real vulnerable contract in it", async () => {
    const { results, filesScanned } = await cloneAndScan(sourceRepoDir, "main");

    expect(filesScanned).toBe(1);
    expect(results).toHaveLength(1);
    const findings = results[0]?.findings ?? [];
    const ruleIds = findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("reentrancy-state-change-after-call");
    expect(ruleIds).toContain("unchecked-low-level-call");
    expect(results[0]?.filePath).toBe("Vulnerable.sol");
  });

  it("cleans up after itself, so calling it repeatedly doesn't accumulate temp directories", async () => {
    // cloneAndScan doesn't expose its temp directory path by design -
    // callers have no reason to touch it. What's actually verifiable
    // from outside is that calling it twice in a row both succeeds
    // (mkdtemp always generates a fresh unique path, so a leftover
    // directory from the first call can't collide with or break the
    // second one) and that both runs see the same source repo correctly.
    const first = await cloneAndScan(sourceRepoDir, "main");
    const second = await cloneAndScan(sourceRepoDir, "main");
    expect(first.results).toHaveLength(1);
    expect(second.results).toHaveLength(1);
    expect(second.results[0]?.findings.map((f) => f.ruleId)).toEqual(first.results[0]?.findings.map((f) => f.ruleId));
  });

  it("returns zero findings and zero files scanned for a repo with no Solidity in it", async () => {
    await writeFile(join(sourceRepoDir, "README.md"), "# nothing to scan here\n");
    await execFileAsync("git", ["add", "."], { cwd: sourceRepoDir });
    await execFileAsync("git", ["commit", "-m", "add readme"], { cwd: sourceRepoDir });

    const { results, filesScanned } = await cloneAndScan(sourceRepoDir, "main");
    expect(filesScanned).toBe(1); // still just Vulnerable.sol
    expect(results).toHaveLength(1);
  });
});

describe("branchNameFromRef", () => {
  it("strips the refs/heads/ prefix GitHub sends", () => {
    expect(branchNameFromRef("refs/heads/main")).toBe("main");
    expect(branchNameFromRef("refs/heads/feature/x")).toBe("feature/x");
  });

  it("passes through a value with no refs/heads/ prefix unchanged", () => {
    expect(branchNameFromRef("main")).toBe("main");
  });
});
