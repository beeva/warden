import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateWebhookSecret, sendWebhookNotification, signWebhookBody } from "./webhook";

describe("generateWebhookSecret", () => {
  it("generates a long random hex string, different every time", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });
});

describe("signWebhookBody", () => {
  it("matches a real independently-computed HMAC-SHA256 digest", () => {
    const body = JSON.stringify({ hello: "world" });
    const expected = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(signWebhookBody(body, "s3cret")).toBe(expected);
  });

  it("produces a different signature for a different secret", () => {
    const body = "{}";
    expect(signWebhookBody(body, "a")).not.toBe(signWebhookBody(body, "b"));
  });
});

describe("sendWebhookNotification", () => {
  let server: Server;
  let received: { body: unknown; signature: string | undefined; event: string | undefined } | null;
  let url: string;

  beforeEach(async () => {
    received = null;
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        received = { body: JSON.parse(raw), signature: req.headers["x-warden-signature"] as string | undefined, event: req.headers["x-warden-event"] as string | undefined };
        res.writeHead(200).end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const payload = {
    event: "scan.blocked" as const,
    org: "acme",
    repo: "vault",
    scanId: 42,
    counts: { critical: 1, high: 0, medium: 0, low: 0, info: 0 },
    dashboardUrl: "https://warden.example/app/acme/vault/scans/42",
    timestamp: "2023-04-18T00:00:00.000Z",
  };

  it("really POSTs the payload with a real, independently-verifiable HMAC signature", async () => {
    await sendWebhookNotification(url, "s3cret", payload);
    expect(received?.body).toEqual(payload);
    expect(received?.event).toBe("scan.blocked");
    const expectedSig = signWebhookBody(JSON.stringify(payload), "s3cret");
    expect(received?.signature).toBe(expectedSig);
  });

  it("does not throw when the endpoint is unreachable", async () => {
    await expect(sendWebhookNotification("http://127.0.0.1:1", "s3cret", payload)).resolves.toBeUndefined();
  });

  it("does not throw when the endpoint returns a non-2xx status", async () => {
    server.close();
    server = createServer((_req, res) => res.writeHead(500).end("nope"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    await expect(sendWebhookNotification(`http://127.0.0.1:${address.port}`, "s3cret", payload)).resolves.toBeUndefined();
  });
});
