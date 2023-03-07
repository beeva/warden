# Warden

Static analysis for smart contracts that models the exploit classes that actually recur on-chain,
runs on every commit, and gates CI on criticals.

> Status: core product built and verified - real Solidity AST parsing, 12 hand-verified detectors,
> a fixture-corpus eval harness (100% precision/recall), a CLI with CI-gating exit codes, a scan
> ingestion API, a GitHub Action, and the org/repo/scan/findings dashboard are all live-tested
> against a running server, real Postgres, and real Solidity fixtures. See the
> [roadmap](#roadmap) below.

## Why

A manual audit right before launch is expensive, infrequent, and misses everything introduced
afterward. The exploit classes that actually drain contracts - reentrancy, tx.origin
confused-deputy auth, unprotected selfdestruct, delegatecall to an untrusted target - are well
known and mostly mechanical to check for, which makes them exactly the kind of thing a computer
should be checking on every single commit, not a human once a quarter.

- **Real static analysis, not regex** - a real Solidity AST (`@solidity-parser/parser`), so
  detectors reason about control flow (does a state write happen after an external call in this
  function?) instead of pattern-matching source text.
- **Validated against a corpus, not vibes** - every detector is checked against real
  vulnerable-and-fixed pairs of fixture contracts, with a precision/recall report, not just
  "it compiled and didn't crash."
- **Runs where the code already lives** - a CLI for local runs, a GitHub Action for CI, and a
  dashboard that ties both together into one audit trail.

## Architecture

- Next.js (App Router) + TypeScript, Tailwind, Postgres via Drizzle
- Session auth (scrypt password hashing, signed session cookies), multi-user orgs with
  owner/member roles
- Real detector engine (`src/lib/detectors/`) - Solidity source is parsed into a real AST, then 16
  detectors each walk it looking for one exploit class:
  - `reentrancy-state-change-after-call` - a low-level `.call(...)` followed by a state write in
    the same function, with no reentrancy guard (SWC-107)
  - `unchecked-low-level-call` - `.call`/`.delegatecall`/`.staticcall`/`.send`'s boolean success
    silently discarded (SWC-104)
  - `tx-origin-authorization` - `tx.origin` used for an authorization check (SWC-115)
  - `unprotected-selfdestruct` - `selfdestruct` reachable with no access-control guard (SWC-106)
  - `delegatecall-to-untrusted-target` - delegatecall's target is a function parameter (SWC-112)
  - `timestamp-dependence` - `block.timestamp` compared directly (SWC-116)
  - `weak-randomness-source` - a hash of block-derived values used as randomness (SWC-120)
  - `floating-pragma` - an unpinned compiler version range (SWC-103)
  - `unbounded-loop-external-call` - a loop over a dynamic array making an external call per
    iteration
  - `missing-zero-address-check` - an address setter with no `address(0)` guard
  - `deprecated-language-construct` - `throw`/`sha3`/`callcode`
  - `unchecked-erc20-transfer` - a bare, unchecked `.transfer`/`.transferFrom` on an ERC20 token
  - `unprotected-initializer` - an `initialize()`-style function with no guard against being called
    more than once - the bug class behind the Wormhole and Audius proxy-takeover incidents
  - `signature-replay-risk` - `ecrecover` used with no apparent nonce or used-signature tracking
    (heuristic - confirms a mechanism looks present, not that it's wired up correctly)
  - `arbitrary-address-send` - a function with no access-control guard sends value to an address
    taken directly from its own parameters (SWC-105-adjacent)
  - `strict-balance-equality` - a contract's ether/token balance compared with `==`/`!=` -
    force-sendable (via `selfdestruct`) or directly transferable, so exact equality is fragile
    (SWC-132-adjacent)
- A fixture corpus (`fixtures/`) of real-shaped vulnerable contracts and their fixed counterparts,
  and an eval harness (`npm run evals`) reporting precision/recall against it - currently 100/100
  on all 20 fixtures, gated strictly on recall (a missed finding is the dangerous failure mode for
  a security scanner; a false positive just costs a few minutes of review)
- `// warden-ignore` / `// warden-ignore: rule-a, rule-b` suppression comments, matched on a
  finding's own line or the line above it (the `eslint-disable-next-line` convention)
- CLI (`warden scan <path>`) - colorized terminal output, `--fail-on <severity>` for CI gating,
  `--upload` to push results to the dashboard
- `action.yml` - a composite GitHub Action wrapping the CLI
- Scan ingestion API (`POST /api/v1/scans`) - authenticated by a per-org API token (SHA-256
  hashed, shown once at creation), auto-creates the repo on first upload, computes severity
  counts and a `blocked` flag (against each repo's own configurable `failThreshold`) the CLI/Action
  use to decide the exit code
- Optional Slack notification (an org-level incoming webhook, `https://` enforced) posted whenever
  a scan crosses its repo's threshold
- Dashboard - orgs, repos, scan history, and a findings table where any member can triage status
  (open/acknowledged/false_positive/fixed) - every scan and status change lands in an audit log

## Getting started

```bash
npm install
cp .env.example .env
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev
```

`npm run db:seed` creates a demo account (`demo@warden.local` / `demo-password-1234`) in a `demo`
org. Scan something without any of that:

```bash
npx tsx src/cli/index.ts scan fixtures/vulnerable
```

## Testing

```bash
npm run test        # unit tests (Vitest) - detectors are hand-verified against real fixture contracts
npm run typecheck
npm run lint
npm run evals        # fixture-corpus precision/recall report, gated on recall
```

## Roadmap

- [x] Domain schema (users, orgs, membership, repos, API tokens, scans, findings, audit log)
- [x] Session auth, multi-user signup and login
- [x] Real Solidity AST parsing (`@solidity-parser/parser`) and a detector-engine framework
- [x] 16 hand-verified exploit-class detectors, 68 unit tests against the real parser
- [x] Fixture corpus (10 vulnerable / 10 safe contracts) and an eval harness - 100% precision and
      recall on all 20, gated strictly on recall
- [x] CLI (`warden scan`) - colorized output, `--fail-on` for CI gating, `--upload`
- [x] Scan ingestion API - token auth, repo auto-create, CI-gate response
- [x] GitHub Action (`action.yml`) wrapping the CLI
- [x] Dashboard - orgs, repos, tokens, scan history, findings triage
- [x] Adversarial review pass - found and fixed a GitHub Actions script-injection hole, an
      unbounded scan-ingestion payload, and missing rate limits on four write endpoints - see
      [SECURITY.md](./SECURITY.md)
- [x] Per-repo configurable CI-gate threshold - live-verified: the same upload reports
      `blocked: false` at the default (critical) threshold and `blocked: true` once an owner
      lowers it
- [x] Suppression comments (`// warden-ignore: rule-id`) for accepted-risk findings
- [x] Slack notification on a blocked scan - real HTTP delivery verified against a local receiver
      in the test, not a mock
- [x] Unprotected-initializer and signature-replay-risk detectors, plus 4 more fixtures
- [x] Pagination on scan/finding history for repos with a long tail
- [x] Account settings (change password)
- [x] Member removal (with a last-owner guard) and repo deletion (type-to-confirm, cascades to
      that repo's own scans/findings)
- [x] CLI `--format json` for machine-readable output
- [x] Integration tests against a real Postgres instance for the query layer (14 tests, own
      uniquely-suffixed org/user per run, torn down afterward) - CI now runs a real Postgres
      service alongside the job for these, not a stub
- [x] Org activity page - the audit trail the schema always had, now visible in the dashboard
- [x] arbitrary-address-send and strict-balance-equality detectors
- [x] `warden init` - scaffolds a starter GitHub Actions workflow, refuses to clobber an existing
      one without `--force`
- [ ] More detectors

## License

MIT
