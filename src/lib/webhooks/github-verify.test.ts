import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubSignature } from "./github-verify";

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyGitHubSignature", () => {
  it("accepts a genuinely computed signature for the exact body signed", () => {
    const body = JSON.stringify({ ref: "refs/heads/main", repository: { clone_url: "https://example.com/x.git" } });
    const secret = "a-real-webhook-secret";
    expect(verifyGitHubSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const body = JSON.stringify({ ref: "refs/heads/main" });
    expect(verifyGitHubSignature(body, sign(body, "wrong-secret"), "correct-secret")).toBe(false);
  });

  it("rejects when the body has changed since the signature was computed", () => {
    const original = JSON.stringify({ ref: "refs/heads/main" });
    const tampered = JSON.stringify({ ref: "refs/heads/evil" });
    expect(verifyGitHubSignature(tampered, sign(original, "secret"), "secret")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyGitHubSignature("{}", null, "secret")).toBe(false);
  });

  it("rejects a header missing the sha256= prefix", () => {
    const body = "{}";
    const bareHex = createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyGitHubSignature(body, bareHex, "secret")).toBe(false);
  });

  it("rejects a malformed non-hex signature without throwing", () => {
    expect(verifyGitHubSignature("{}", "sha256=not-valid-hex!!", "secret")).toBe(false);
  });
});
