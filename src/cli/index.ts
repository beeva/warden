#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { Command } from "commander";
import { scanSource } from "../lib/detectors/scan";
import type { Severity } from "../lib/detectors/types";
import { findSolidityFiles } from "./find-files";
import { countBySeverity, formatResults, formatResultsJson } from "./format";
import { wardenWorkflowTemplate } from "./init-template";
import { meetsThreshold } from "./severity";
import { uploadResults } from "./upload";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
const FORMATS = ["text", "json"] as const;

// A real .sol file is a few KB to a few hundred KB at most - this is
// generous headroom above that, not a tight fit. Scanning is meant to
// run against code you don't fully trust yet, so a single pathological
// (or malicious, e.g. checked in by a compromised dependency) huge file
// shouldn't be read fully into memory before anything can reject it.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const program = new Command();

program.name("warden").description("Static analysis for Solidity smart contracts").version("0.1.0");

program
  .command("scan")
  .description("Scan Solidity files or a directory for known exploit-class patterns")
  .argument("<path>", "file or directory to scan")
  .option("--fail-on <severity>", `exit non-zero if a finding at or above this severity exists (${SEVERITIES.join("|")})`, "critical")
  .option("--no-fail", "always exit 0, regardless of findings")
  .option("--no-color", "disable ANSI color in output")
  .option("--format <text|json>", "output format", "text")
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

    const format = opts.format as string;
    if (!FORMATS.includes(format as (typeof FORMATS)[number])) {
      console.error(`--format must be one of: ${FORMATS.join(", ")}`);
      process.exitCode = 2;
      return;
    }
    const isJson = format === "json";

    const files = findSolidityFiles(targetPath);
    if (files.length === 0) {
      console.error(`no .sol files found under ${targetPath}`);
      process.exitCode = 2;
      return;
    }

    // One unreadable file (permissions, a race with something deleting
    // it, a symlink loop) shouldn't abort the whole batch - scanSource's
    // own parse step already catches parser-internal failures (including
    // a stack overflow on pathologically nested input) and reports them
    // as a per-file parseError, so this only needs to guard the read.
    const results = files.map((filePath) => {
      try {
        if (statSync(filePath).size > MAX_FILE_SIZE_BYTES) {
          return { filePath, findings: [], parseError: `skipped - larger than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` };
        }
        return scanSource(filePath, readFileSync(filePath, "utf8"));
      } catch (err) {
        return { filePath, findings: [], parseError: err instanceof Error ? err.message : String(err) };
      }
    });

    if (!isJson) console.log(formatResults(results, opts.color !== false));

    // In JSON mode, everything (results, counts, and upload outcome)
    // lands in the one JSON object printed at the end, rather than
    // interleaving prose with machine-readable output - a consumer
    // piping stdout into `jq` shouldn't have to strip anything out first.
    let uploadOutcome: { scanId: number; blocked: boolean } | { error: string } | undefined;

    if (opts.upload) {
      const token = opts.token ?? process.env.WARDEN_TOKEN;
      if (!token || !opts.repo) {
        const message = "--upload requires --repo and a token (--token or WARDEN_TOKEN)";
        if (isJson) {
          uploadOutcome = { error: message };
        } else {
          console.error(message);
          process.exitCode = 2;
          return;
        }
      } else {
        try {
          const uploaded = await uploadResults(results, {
            apiUrl: opts.apiUrl,
            token,
            repoSlug: opts.repo,
            commitSha: opts.commit,
            branch: opts.branch,
          });
          uploadOutcome = uploaded;
          if (!isJson) console.log(`\nuploaded as scan #${uploaded.scanId}${uploaded.blocked ? " - dashboard marks this blocked" : ""}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          uploadOutcome = { error: message };
          if (!isJson) {
            console.error(`\nupload failed: ${message}`);
            process.exitCode = 1;
            return;
          }
        }
      }
    }

    if (isJson) {
      const summary = JSON.parse(formatResultsJson(results));
      console.log(JSON.stringify({ ...summary, upload: uploadOutcome }, null, 2));
    }

    if (uploadOutcome && "error" in uploadOutcome) {
      process.exitCode = 1;
      return;
    }

    if (opts.fail === false) return;

    const counts = countBySeverity(results);
    if (meetsThreshold(counts, failOn as Severity)) {
      process.exitCode = 1;
    }
  });

program
  .command("init")
  .description("Scaffold a GitHub Actions workflow that runs `warden scan` on every push and PR")
  .option("--repo <slug>", "repo slug to associate uploads with (defaults to the current directory's name)")
  .option("--force", "overwrite an existing .github/workflows/warden.yml")
  .action((opts) => {
    const repoSlug = opts.repo ?? basename(resolve(process.cwd()));
    const outPath = resolve(process.cwd(), ".github/workflows/warden.yml");

    if (existsSync(outPath) && !opts.force) {
      console.error(`${outPath} already exists - pass --force to overwrite it`);
      process.exitCode = 1;
      return;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, wardenWorkflowTemplate(repoSlug));
    console.log(`wrote ${outPath}`);
    console.log(`Set the WARDEN_TOKEN secret in this repo's settings, then create an org token with:`);
    console.log(`  POST /api/orgs/:slug/tokens {"label": "ci-github-actions"}`);
  });

program.parseAsync(process.argv);
