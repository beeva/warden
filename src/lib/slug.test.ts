import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Security Inc.")).toBe("acme-security-inc");
  });

  it("collapses repeated separators", () => {
    expect(slugify("foo   bar___baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("caps length at 100 characters", () => {
    expect(slugify("a".repeat(200)).length).toBe(100);
  });
});
