import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatBlockedScanMessage, sendSlackNotification } from "./slack";

describe("formatBlockedScanMessage", () => {
  it("lists only severities with a nonzero count, in severity order", () => {
    const message = formatBlockedScanMessage({
      orgName: "Acme",
      repoName: "vault",
      scanId: 42,
      counts: { critical: 2, high: 0, medium: 1, low: 0, info: 0 },
      dashboardUrl: "https://warden.example/app/acme/vault/scans/42",
    });
    expect(message.text).toContain("Acme/vault");
    expect(message.text).toContain("scan #42");
    expect(message.text).toContain("2 critical, 1 medium");
    expect(message.text).not.toContain("0 high");
    expect(message.text).toContain("https://warden.example/app/acme/vault/scans/42");
  });
});

describe("sendSlackNotification", () => {
  let server: Server;
  let received: { body: unknown; contentType: string | undefined } | null;
  let url: string;

  beforeEach(async () => {
    received = null;
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        received = { body: JSON.parse(raw), contentType: req.headers["content-type"] };
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

  it("really POSTs the message as JSON over real HTTP", async () => {
    await sendSlackNotification(url, { text: "hello from warden" });
    expect(received).toEqual({ body: { text: "hello from warden" }, contentType: "application/json" });
  });

  it("does not throw when the endpoint is unreachable", async () => {
    await expect(sendSlackNotification("http://127.0.0.1:1", { text: "x" })).resolves.toBeUndefined();
  });

  it("does not throw when the endpoint returns a non-2xx status", async () => {
    server.close();
    server = createServer((_req, res) => res.writeHead(500).end("nope"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    await expect(sendSlackNotification(`http://127.0.0.1:${address.port}`, { text: "x" })).resolves.toBeUndefined();
  });
});
