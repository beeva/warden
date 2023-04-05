import { describe, expect, it } from "vitest";
import { auditLogToCsv } from "./audit-log-csv";

describe("auditLogToCsv", () => {
  it("produces a header row plus one row per entry", () => {
    const csv = auditLogToCsv([
      { createdAt: new Date("2023-01-01T00:00:00Z"), actorEmail: "a@example.com", action: "repo.created", targetType: "repo", targetId: 1, metadata: null },
    ]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("createdAt,actor,action,targetType,targetId,metadata");
    expect(lines[1]).toBe("2023-01-01T00:00:00.000Z,a@example.com,repo.created,repo,1,");
  });

  it("labels a null actor (a token/webhook-triggered action) as 'via API' rather than blank", () => {
    const csv = auditLogToCsv([{ createdAt: new Date(), actorEmail: null, action: "scan.completed", targetType: "scan", targetId: 1, metadata: null }]);
    expect(csv).toContain("via API");
  });

  it("serializes metadata as JSON, quoted since it contains commas", () => {
    const csv = auditLogToCsv([
      { createdAt: new Date(), actorEmail: "a@example.com", action: "finding.status_changed", targetType: "finding", targetId: 1, metadata: { from: "open", to: "fixed" } },
    ]);
    expect(csv).toContain('"{""from"":""open"",""to"":""fixed""}"');
  });

  it("produces just the header for an empty log", () => {
    expect(auditLogToCsv([])).toBe("createdAt,actor,action,targetType,targetId,metadata");
  });
});
