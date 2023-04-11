import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "warden-config-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns an empty config when no file is present", () => {
    expect(loadConfig(dir)).toEqual({});
  });

  it("reads a real valid config file from disk", () => {
    writeFileSync(join(dir, "warden.config.json"), JSON.stringify({ failOn: "high", repo: "my-protocol", exclude: ["vendor"] }));
    expect(loadConfig(dir)).toEqual({ failOn: "high", repo: "my-protocol", exclude: ["vendor"] });
  });

  it("falls back to {} and warns, rather than throwing, on malformed JSON", () => {
    writeFileSync(join(dir, "warden.config.json"), "{ not valid json");
    const originalError = console.error;
    let warned = false;
    console.error = () => {
      warned = true;
    };
    try {
      expect(loadConfig(dir)).toEqual({});
      expect(warned).toBe(true);
    } finally {
      console.error = originalError;
    }
  });

  it("falls back to {} and warns on a wrong-shaped config (e.g. an invalid failOn value)", () => {
    writeFileSync(join(dir, "warden.config.json"), JSON.stringify({ failOn: "catastrophic" }));
    const originalError = console.error;
    let warned = false;
    console.error = () => {
      warned = true;
    };
    try {
      expect(loadConfig(dir)).toEqual({});
      expect(warned).toBe(true);
    } finally {
      console.error = originalError;
    }
  });

  it("accepts a config with only some fields set", () => {
    writeFileSync(join(dir, "warden.config.json"), JSON.stringify({ failOn: "medium" }));
    expect(loadConfig(dir)).toEqual({ failOn: "medium" });
  });
});
