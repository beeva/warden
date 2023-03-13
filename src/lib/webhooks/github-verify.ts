import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

/**
 * GitHub's documented webhook signing scheme: HMAC-SHA256 over the raw
 * request body, hex-encoded, sent as `X-Hub-Signature-256: sha256=<hex>`.
 * Verified against the raw body specifically - re-serializing a parsed
 * JSON object before hashing can produce different bytes (key order,
 * whitespace) than what GitHub actually signed, which would make a
 * legitimate webhook fail verification.
 */
export function verifyGitHubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(signatureHeader.slice(SIGNATURE_PREFIX.length), "hex");

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
