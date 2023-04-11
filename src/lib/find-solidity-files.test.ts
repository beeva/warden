import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findSolidityFiles } from "./find-solidity-files";

describe("findSolidityFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "warden-find-files-test-"));
    writeFileSync(join(dir, "A.sol"), "// a");
    writeFileSync(join(dir, "readme.md"), "not solidity");
    mkdirSync(join(dir, "vendor"));
    writeFileSync(join(dir, "vendor", "B.sol"), "// b");
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "C.sol"), "// c");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("finds real .sol files recursively and skips non-.sol files", () => {
    const files = findSolidityFiles(dir);
    expect(files.some((f) => f.endsWith("A.sol"))).toBe(true);
    expect(files.some((f) => f.endsWith("B.sol"))).toBe(true);
    expect(files.some((f) => f.endsWith("readme.md"))).toBe(false);
  });

  it("always excludes node_modules, built-in", () => {
    const files = findSolidityFiles(dir);
    expect(files.some((f) => f.endsWith("C.sol"))).toBe(false);
  });

  it("excludes an extra configured directory on top of the built-in list", () => {
    const files = findSolidityFiles(dir, ["vendor"]);
    expect(files.some((f) => f.endsWith("A.sol"))).toBe(true);
    expect(files.some((f) => f.endsWith("B.sol"))).toBe(false);
  });

  it("returns a single file path as-is when pointed directly at a .sol file", () => {
    const filePath = join(dir, "A.sol");
    expect(findSolidityFiles(filePath)).toEqual([filePath]);
  });
});
