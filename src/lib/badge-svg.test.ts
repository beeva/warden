import { describe, expect, it } from "vitest";
import { renderBadgeSvg } from "./badge-svg";

describe("renderBadgeSvg", () => {
  it("produces well-formed SVG containing both the label and message text", () => {
    const svg = renderBadgeSvg("security scan", "passing", "#4c1");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain(">security scan<");
    expect(svg).toContain(">passing<");
    expect(svg).toContain('fill="#4c1"');
  });

  it("escapes XML-significant characters in the label and message", () => {
    const svg = renderBadgeSvg('a & b <c>', '"quoted"', "#e05d44");
    expect(svg).toContain("a &amp; b &lt;c&gt;");
    expect(svg).toContain("&quot;quoted&quot;");
    expect(svg).not.toContain('a & b <c>');
  });

  it("widens the badge for a longer message rather than a fixed size", () => {
    const short = renderBadgeSvg("x", "ok", "#4c1");
    const long = renderBadgeSvg("x", "3 critical findings", "#e05d44");
    const widthOf = (svg: string) => Number(/width="(\d+)"/.exec(svg)?.[1] ?? 0);
    expect(widthOf(long)).toBeGreaterThan(widthOf(short));
  });

  it("keeps every opened tag balanced with a matching close", () => {
    const svg = renderBadgeSvg("security scan", "1 critical", "#e05d44");
    for (const tag of ["svg", "linearGradient", "clipPath", "g", "text"]) {
      const opens = (svg.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
      const closes = (svg.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
      expect(closes, `<${tag}> open/close count should match`).toBe(opens);
    }
  });
});
