// No "server-only" guard here: this module is imported both by the web
// app's token-creation route and by anything that needs to verify a
// token offline (future test tooling). node:crypto is unbundlable for
// the browser regardless.
import { randomBytes, createHash } from "node:crypto";

const TOKEN_PREFIX = "wdn_";

/**
 * Unlike a password, a raw API token is already high-entropy random bytes
 * - there's no offline dictionary attack to slow down with scrypt, so a
 * plain SHA-256 digest is the right tool here (the same approach GitHub
 * and Stripe use for their own API keys). What's stored is only ever the
 * hash; the raw value is shown to the user exactly once, at creation.
 */
export function generateApiToken(): { raw: string; hash: string } {
  const raw = `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashApiToken(raw) };
}

export function hashApiToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
