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
- **Runs where the code already lives** - a CLI for local runs, a GitHub Action for CI, an optional
  push-triggered GitHub webhook that scans server-side with no CI runner needed at all, and a
  dashboard that ties all three into one audit trail.

## Architecture

- Next.js (App Router) + TypeScript, Tailwind, Postgres via Drizzle
- Session auth (scrypt password hashing, signed session cookies), multi-user orgs with
  owner/member roles
- Real detector engine (`src/lib/detectors/`) - Solidity source is parsed into a real AST, then 19
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
  - `locked-ether` - a contract can receive ether (`receive()`/a payable function) but has no
    function anywhere that ever sends value back out - whole-contract analysis, not per-function,
    and deliberately silent on proxy contracts (a payable fallback that delegatecalls elsewhere
    delegates its entire logic, including any withdraw path, to a contract this scan can't see)
  - `hash-collision-encode-packed` - `keccak256(abi.encodePacked(...))` with 2+ variable-length
    arguments (string/bytes/a dynamic array) - no length delimiter between them means different
    inputs can pack down to identical bytes (SWC-133), scoped to a function's own parameter types
    so this is a real type check, not a guess based on variable naming
  - `tx-origin-as-recipient` - `tx.origin` used as the destination of a value transfer or an ERC20
    `transfer`/`transferFrom`, rather than `msg.sender` - a distinct confused-deputy hazard from
    the auth-comparison case above (same root cause, different exploit shape)
- A fixture corpus (`fixtures/`) of real-shaped vulnerable contracts and their fixed counterparts,
  and an eval harness (`npm run evals`) reporting precision/recall against it - currently 100/100
  on all 26 fixtures, gated strictly on recall (a missed finding is the dangerous failure mode for
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
- [x] Scan-to-scan diff - new/resolved finding counts against the previous completed scan, matched
      by rule + file + line since findings have no stable identity across separate uploads
- [x] Public `/rules` reference page, generated straight from `detectorRegistry` - can't drift out
      of date with what the engine actually runs
- [x] GitHub webhook push-triggered scanning - server-side shallow clone + scan on every push, no
      CI runner or CLI needed. HMAC-SHA256 verified (GitHub's own scheme), owner-only to connect.
      Live-verified end to end against a real local git repo: a genuine `git clone` subprocess, a
      real vulnerable contract scanned, correct findings recorded with the real commit SHA and
      branch, and a forged signature correctly rejected with 401
- [x] Webhook delivery history - every inbound GitHub webhook attempt (verified or not) recorded
      and shown per repo, the same "recent deliveries" concept GitHub's own settings page has
- [x] locked-ether detector - found and fixed a real false positive live (a proxy-pattern contract
      was flagged before the delegatecall exclusion existed) via the eval harness, not by
      inspection
- [x] GitHub webhook also handles `pull_request` (opened/synchronize/reopened) - scans the PR's
      head commit, the common "block merge on critical" pattern. Live-verified against a real repo
      with two branches: an "opened" event correctly scanned the feature branch and found its real
      vulnerability, a "closed" event was correctly ignored, and a plain push still scans main
      exactly as before
- [x] CSV export of a scan's findings - RFC 4180-shaped quoting, live-verified with real
      comma/quote-containing content and confirmed cross-org access correctly 404s
- [x] Per-repo ignored rules - coarser than a `warden-ignore` comment (a whole rule for a whole
      repo, not one line), filtered server-side before a finding is ever inserted so it can't
      silently affect the CI-gate decision either. Live-verified: uploading the same findings
      before/after ignoring floating-pragma dropped the info count from 1 to 0, and the row was
      confirmed never inserted at all, not just hidden
- [x] Compare any two scans, not just consecutive ones - a form picking from every scan for the
      repo, listing the actual new/resolved findings (not just counts). Live-verified against
      three real uploads: a finding that stayed present across both scans correctly showed up in
      neither the new nor resolved list, only in the unchanged count
- [x] hash-collision-encode-packed detector, plus a fixture pair - 24/24 exact match
- [x] Public README status badge (`/api/orgs/:slug/repos/:repoSlug/badge`) - hand-rolled SVG, no
      image library or external service call. Live-verified all four real states: unknown
      org/repo, no scans yet, passing, and failing (against the repo's own fail-threshold, the
      same rule the real CI gate uses)
- [x] Invite-link flow for adding members - closes the "no invite email" gap noted in
      [SECURITY.md](./SECURITY.md). Single-use, 7-day expiry, owner-only to create. Live-verified
      end to end with two real accounts: create → public preview (unauthenticated) → accept → a
      real membership row, a second accept attempt correctly 410s, and an unauthenticated accept
      attempt correctly 401s. Also added `?next=` support to login (with open-redirect protection
      - only a same-origin relative path is honored) so accepting an invite while logged out
      returns you to the invite after signing in
- [x] tx-origin-as-recipient detector, plus a fixture pair - 26/26 exact match
- [x] Org deletion - owner-only, type-to-confirm, cascades to every repo (and each repo's own
      scans/findings/webhook deliveries), member, API token, and invite. Live-verified: an
      outsider gets a generic 404 (not a 403 that would confirm the org exists), the owner's
      delete succeeds, and a direct query confirmed the org, its repo, its API token, and the
      scan/finding rows were all genuinely gone afterward
- [x] Self-service "leave org" - any member (owner or not) can remove themselves without needing
      another owner to act for them, guarded by the same last-owner check member removal already
      has. Live-verified: a sole owner is correctly blocked with 409, a regular member leaves
      successfully and their membership row is confirmed gone
- [x] Change a member's role (promote to owner / demote to member), completing the org governance
      story alongside add/remove/leave/delete - guarded by the same last-owner check throughout.
      Live-verified a full ownership transfer end to end: demoting the sole owner correctly 409s,
      promoting the other member to owner succeeds, and only then does demoting the original
      owner succeed - confirmed by a direct query showing the roles had actually swapped
- [ ] More detectors

## License

MIT
