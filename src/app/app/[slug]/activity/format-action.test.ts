import { describe, expect, it } from "vitest";
import { formatAction, formatDetail } from "./format-action";

describe("formatAction", () => {
  it("maps a known action to a readable label", () => {
    expect(formatAction("repo.created")).toBe("created a repo");
    expect(formatAction("member.removed")).toBe("removed a member");
  });

  it("falls back to the raw action string for anything unmapped", () => {
    expect(formatAction("some.future.action")).toBe("some.future.action");
  });
});

describe("formatDetail", () => {
  it("summarizes a finding status change", () => {
    expect(formatDetail("finding.status_changed", { from: "open", to: "acknowledged" })).toBe("open → acknowledged");
  });

  it("summarizes a scan's nonzero severity counts", () => {
    expect(formatDetail("scan.completed", { counts: { critical: 2, high: 0, medium: 1, low: 0, info: 0 } })).toBe("2 critical, 1 medium");
  });

  it("reports a clean scan explicitly rather than an empty string", () => {
    expect(formatDetail("scan.completed", { counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } })).toBe("no findings");
  });

  it("summarizes a member role change", () => {
    expect(formatDetail("member.role_changed", { from: "member", to: "owner" })).toBe("member → owner");
  });

  it("returns null for an action with no useful metadata to show", () => {
    expect(formatDetail("member.added", { anything: "here" })).toBeNull();
    expect(formatDetail("token.created", null)).toBeNull();
  });
});
