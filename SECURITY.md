# Security

## Reporting a vulnerability

If you find a security issue in Warden, please open a GitHub issue or reach out directly rather
than filing a public PR with the fix. Include enough detail to reproduce it - endpoint, request,
and expected vs. actual behavior.

## Design notes

A few decisions worth knowing if you're auditing this codebase - including real bugs an
adversarial review pass found and fixed, since a security doc that only lists the good decisions
isn't telling the whole story.

- **Every org-scoped route re-derives membership from the session, not from a bare login check.**
  `getOrgForMember(slug, userId)` is the single source of truth used by every API route and every
  server page - a request that's authenticated but not a member of the org named in the URL gets
  the same 404 as a nonexistent org, not a 403 that would confirm the org exists. Repo/scan/finding
  lookups go one level further (`repoBelongsToOrg`, `scanBelongsToOrg`) so a finding ID or scan ID
  from another org can't be walked into by guessing IDs while authenticated as a member of a
  *different* org.
- **A GitHub Actions script-injection hole in `action.yml`.** `${{ }}` expressions are expanded by
  literal text substitution into the generated shell script *before* bash ever runs it - a ref
  name or input containing backticks or `$()`, interpolated directly into a `run:` block, becomes
  executable shell code. The original action.yml did exactly that with `github.ref_name` and every
  input. A contributor opening a PR from a branch named like a shell command would have been
  enough to run arbitrary code in the job, with access to any configured secrets (`WARDEN_TOKEN`,
  the job's own `GITHUB_TOKEN`). Found in an adversarial review pass, fixed by routing every
  `${{ }}` value through `env:` and referencing `$VAR` in the script instead - environment-variable
  expansion isn't subject to the same pre-parse substitution.
- **The scan-ingestion API had no real bound on payload size.** `POST /api/v1/scans` capped the
  findings array at 5000 entries, but none of the string fields inside each finding had a max
  length, and nothing capped the raw request body before `request.json()` buffers it fully into
  memory - Next's App Router route handlers have no built-in body-size limit on the Node runtime.
  A single request from one leaked CI/API token was enough to send a body large enough to OOM the
  server process, well before the 30/hour per-token rate limit could ever engage. Found in the
  same review pass, fixed with per-field string caps sized to what a real finding actually needs
  (`message` ≤ 2000 chars, `snippet` ≤ 5000, etc.) plus a `Content-Length` check ahead of the JSON
  parse. Live-verified: an 11MB body now 413s before it's ever parsed, and a single over-length
  field now 400s with a clear validation error instead of being silently truncated or accepted.
- **Repo creation, token mint/revoke, and finding-status updates had no rate limit at all**, unlike
  signup, login, member-add, and scan upload, which all did. All four require an authenticated
  session (token mint/revoke additionally require the `owner` role), so this was never an
  unauthenticated-enumeration issue - but a compromised or malicious account could otherwise
  hammer any of them unbounded, and repo creation in particular had no per-org cap of any kind.
  Found in the same review pass, fixed with the same `rateLimit()` helper already used elsewhere.
- **API tokens are stored as a SHA-256 hash, not scrypt.** Unlike a password, a raw token is
  already high-entropy random bytes (`randomBytes(24)`) - there's no offline dictionary attack to
  slow down, so a fast hash is the right tool here, the same approach GitHub and Stripe use for
  their own API keys. The raw value is returned exactly once, at creation; only the hash is ever
  stored or logged.
- **Token creation and revocation, and adding a member, are owner-only** - a token scopes to the
  whole org's repos, so a plain member minting one would be a privilege-escalation path (upload
  scan results as if they were CI, against any repo in the org, with no further check). Changing a
  finding's status is deliberately *not* owner-gated - triage is routine day-to-day work, not a
  privileged action - but every status change still lands in the audit log with who made it.
- **Adding a member by email lets an owner learn whether an arbitrary email has a Warden account**
  (a 404 "no account with this email exists yet" vs. a 409 "already a member"). This is inherent
  to the "add an existing account" design and is rate-limited (20/hour) but not eliminated - noted
  as a known, understood gap for that specific path rather than something silently left
  unaddressed. The invite-link flow below doesn't have this problem at all (it never takes an
  email as input), and is the recommended way to add someone who doesn't have an account yet.
- **Invite links are single-use, time-limited (7 days), and owner-only to create** - a token is
  the sole credential (there's no email service in this deployment, so the owner copies a link and
  sends it however they normally would), stored and matched directly rather than hashed, since
  unlike a password there's nothing to look up by anything other than the exact token itself.
  Accepting requires a real session (the preview endpoint, `GET /api/invites/:token`, is
  deliberately public - it only returns an org name and a role, enough to decide whether to accept
  before signing up or logging in, the same preview-before-auth pattern Slack/GitHub invite links
  use) and is wrapped in a single DB transaction with the membership insert, so a double-accept
  race (two tabs, a double-click) can mark the invite used without ever creating two memberships.
- **Session auth** (`src/lib/auth/session.ts`) is a signed (HS256) JWT in an httpOnly,
  `sameSite: lax` cookie, verified by `src/middleware.ts` before any `/app/*` page renders - not a
  layout-level `redirect()`, which Next can stream a protected page's RSC payload around in some
  cases.
- **Login doesn't leak which emails have accounts.** A nonexistent email is checked against a
  fixed dummy scrypt hash before responding, so the "no such account" and "wrong password" paths
  cost the same wall-clock time and aren't distinguishable by timing.
- **Login's post-auth redirect (`?next=`, used to return to an invite link after signing in) only
  honors a same-origin, single-leading-slash relative path** - `//evil.com` and `https://evil.com`
  are both rejected in favor of a safe `/app` fallback. An unvalidated `next` param redirecting
  after login is a classic open-redirect vector, and an invite link is exactly the kind of URL
  people click without much scrutiny, which is what makes it worth guarding here specifically.
- **The CLI is meant to scan code you don't yet trust, so it's built to not fall over on it.** A
  single unreadable file no longer aborts the whole `warden scan` invocation (each file's
  read+scan is now independently caught and reported as that file's own parse error), and a file
  above 5MB is skipped rather than read fully into memory - real Solidity files are a few KB to a
  few hundred KB at most. `parseSolidity` itself already catches any error the parser throws,
  including a stack overflow on pathologically nested input, and reports it as a normal parse
  failure rather than crashing the process.
- **The web app never parses raw Solidity server-side** - the ingestion API only accepts
  pre-computed JSON findings (the CLI does the actual parsing/scanning locally or in CI), so the
  detector engine's own robustness matters for the CLI's operator, not as a server-side attack
  surface.

## Verifying findings

Every fix above was live-tested against a real running server and real Postgres - not just a unit
test - as part of building this project: a normal CLI upload still succeeds, an oversized request
body now 413s, an over-length field now 400s, and the new rate limits were exercised directly
against the running API. The detector engine is separately verified two ways: 42 unit tests
against the real parser in `src/lib/detectors/rules/*.test.ts`, and a fixture-corpus eval harness
(`npm run evals`) reporting 100% precision and recall across 12 real vulnerable/safe contract
pairs.
