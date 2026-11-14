import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("homepage chapter fields", () => {
  const css = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const homepage = readFileSync(
    path.resolve(__dirname, "../pages/DigeratiHomepage.tsx"),
    "utf8",
  );
  const insights = readFileSync(
    path.resolve(__dirname, "../pages/sections/DigeratiThreatsInsightsSection.tsx"),
    "utf8",
  );

  it("defines grain, paper grain, film overlay, lighting, and surface fade as opt-in utilities", () => {
    expect(css).toContain("--de-field-grain:");
    expect(css).toContain("--de-field-grain-paper:");
    expect(css).toContain(".de-field-grain {");
    expect(css).toContain(".de-field-grain-paper {");
    expect(css).toContain(".de-field-grain-film::after");
    expect(css).toContain(".de-field-lit::before");
    expect(css).toContain(".de-chapter-fade-to-surface");
    expect(css).toContain("isolation: isolate");
  });

  it("keeps lighting as radial washes, not a violet fill", () => {
    const litBlock = css.slice(css.indexOf(".de-field-lit::before"), css.indexOf(".de-field-lit::before") + 520);
    expect(litBlock).toContain("rgba(211, 18, 106");
    expect(litBlock).toContain("rgba(91, 69, 224");
    expect(litBlock).not.toMatch(/background-color:\s*#(5B45E0|8B5CF6|7c3aed)/i);
  });

  it("keeps the homepage to seven chapters and moves threat insights off the main conversion path", () => {
    expect(insights).toMatch(/className="de-dark-well/);
    expect(homepage).not.toContain("DigeratiThreatsInsightsSection");
    expect(homepage).toContain("DigeratiPricingSection");
    expect(homepage.match(/<ScrollSectionAuto id=/g)).toHaveLength(7);
    for (const id of ["hero", "risk", "engagement", "ecosystem", "proof", "leadership", "next-step"]) {
      expect(homepage).toContain(`id="${id}"`);
    }
  });
});
