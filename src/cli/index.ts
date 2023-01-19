#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { scanSource } from "../lib/detectors/scan";
import type { Severity } from "../lib/detectors/types";
import { findSolidityFiles } from "./find-files";
import { countBySeverity, formatResults } from "./format";
import { meetsThreshold } from "./severity";
import { uploadResults } from "./upload";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

const program = new Command();

program.name("warden").description("Static analysis for Solidity smart contracts").version("0.1.0");

program
  .command("scan")
  .description("Scan Solidity files or a directory for known exploit-class patterns")
  .argument("<path>", "file or directory to scan")
  .option("--fail-on <severity>", `exit non-zero if a finding at or above this severity exists (${SEVERITIES.join("|")})`, "critical")
  .option("--no-fail", "always exit 0, regardless of findings")
  .option("--no-color", "disable ANSI color in output")
  .option("--upload", "upload results to the Warden dashboard (requires --repo, --token or WARDEN_TOKEN)")
  .option("--repo <slug>", "repo slug to upload against")
  .option("--token <token>", "API token (falls back to WARDEN_TOKEN env var)")
  .option("--api-url <url>", "dashboard API base URL", process.env.WARDEN_API_URL ?? "http://localhost:3522")
  .option("--commit <sha>", "commit SHA to associate with this scan")
  .option("--branch <name>", "branch name to associate with this scan")
  .action(async (targetPath: string, opts) => {
    const failOn = opts.failOn as string;
    if (!SEVERITIES.includes(failOn as Severity)) {
      console.error(`--fail-on must be one of: ${SEVERITIES.join(", ")}`);
      process.exitCode = 2;
      return;
    }

    const files = findSolidityFiles(targetPath);
    if (files.length === 0) {
      console.error(`no .sol files found under ${targetPath}`);
      process.exitCode = 2;
      return;
    }

    const results = files.map((filePath) => scanSource(filePath, readFileSync(filePath, "utf8")));
    console.log(formatResults(results, opts.color !== false));

    if (opts.upload) {
      const token = opts.token ?? process.env.WARDEN_TOKEN;
      if (!token || !opts.repo) {
        console.error("--upload requires --repo and a token (--token or WARDEN_TOKEN)");
        process.exitCode = 2;
        return;
      }
      try {
        const uploaded = await uploadResults(results, {
          apiUrl: opts.apiUrl,
          token,
          repoSlug: opts.repo,
          commitSha: opts.commit,
          branch: opts.branch,
        });
        console.log(`\nuploaded as scan #${uploaded.scanId}${uploaded.blocked ? " - dashboard marks this blocked" : ""}`);
      } catch (err) {
        console.error(`\nupload failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
        return;
      }
    }

    if (opts.fail === false) return;

    const counts = countBySeverity(results);
    if (meetsThreshold(counts, failOn as Severity)) {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
