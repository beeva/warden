import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv";

describe("csvField", () => {
  it("leaves a plain field unquoted", () => {
    expect(csvField("plain text")).toBe("plain text");
    expect(csvField(42)).toBe("42");
  });

  it("renders null as an empty field, not the string 'null'", () => {
    expect(csvField(null)).toBe("");
  });

  it("quotes a field containing a comma", () => {
    expect(csvField("a, b, c")).toBe('"a, b, c"');
  });

  it("quotes and escapes a field containing a double quote", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
  });
});

describe("toCsv", () => {
  it("joins the header and rows with \\r\\n", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("produces just the header for an empty row list", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b");
  });
});
