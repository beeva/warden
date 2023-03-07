import { describe, expect, it } from "vitest";
import { wardenWorkflowTemplate } from "./init-template";

describe("wardenWorkflowTemplate", () => {
  it("embeds the given repo slug into the generated workflow", () => {
    const yaml = wardenWorkflowTemplate("my-protocol");
    expect(yaml).toContain("repo: my-protocol");
  });

  it("references the secrets.WARDEN_TOKEN convention, not a literal token", () => {
    const yaml = wardenWorkflowTemplate("my-protocol");
    expect(yaml).toContain("secrets.WARDEN_TOKEN");
    expect(yaml).not.toContain("wdn_");
  });

  it("produces valid-looking YAML with no unresolved template markers", () => {
    const yaml = wardenWorkflowTemplate("my-protocol");
    expect(yaml).not.toContain("undefined");
    expect(yaml).not.toMatch(/\$\{(?!\{)/); // no bare ${...} left over, only the intentional ${{ }} GitHub Actions syntax
  });
});
