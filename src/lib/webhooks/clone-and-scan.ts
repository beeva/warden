import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { scanSource } from "@/lib/detectors/scan";
import type { ScanFileResult } from "@/lib/detectors/types";
import { findSolidityFiles } from "@/lib/find-solidity-files";

const execFileAsync = promisify(execFile);

// A shallow, single-branch clone is enough to scan the code as it
// currently stands on that branch - there's no need for history, tags,
// or other branches, and skipping them keeps this fast and bounded
// regardless of how large the target repo's full history is.
const CLONE_TIMEOUT_MS = 60_000;
const CLONE_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export interface CloneAndScanResult {
  results: ScanFileResult[];
  filesScanned: number;
}

/** "refs/heads/main" -> "main" - what git clone --branch actually wants, not the full ref path GitHub sends in its webhook payload. */
export function branchNameFromRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}

/**
 * Shallow-clones a repo to a fresh temp directory, scans every .sol file
 * it finds, and removes the directory afterward regardless of success or
 * failure - this is what powers push-triggered scanning without any CI
 * runner or CLI on the consumer's side, so it has to be safe to call
 * repeatedly and unattended from a webhook handler with no human
 * watching for a leaked temp directory.
 */
export async function cloneAndScan(cloneUrl: string, branch?: string): Promise<CloneAndScanResult> {
  const dir = await mkdtemp(join(tmpdir(), "warden-clone-"));
  try {
    const args = ["clone", "--depth", "1", "--single-branch"];
    if (branch) args.push("--branch", branch);
    args.push(cloneUrl, dir);
    await execFileAsync("git", args, { timeout: CLONE_TIMEOUT_MS, maxBuffer: CLONE_MAX_BUFFER_BYTES });

    const files = findSolidityFiles(dir);
    const results = await Promise.all(
      files.map(async (filePath) => {
        const source = await readFile(filePath, "utf8");
        // Relative to the clone root, not the temp directory's own
        // randomly-generated path - a finding's filePath should read
        // the same on every run, not embed a fresh tmpdir name each time.
        return scanSource(relative(dir, filePath).split("\\").join("/"), source);
      })
    );

    return { results, filesScanned: files.length };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
