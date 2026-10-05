import { describe, expect, it } from "vitest";
import { htmlTitle } from "../../server/pdf/finalizePdf";
import { storePdfCases } from "./storePdfCases";
import { LIFECYCLE_TERMS, pageProblem, parseVerifyOutput, textProblems } from "./storePdfChecks";

describe("pageProblem", () => {
  it("checks exact counts and ranges", () => {
    expect(pageProblem(1, { exact: 1 })).toBeNull();
    expect(pageProblem(2, { exact: 1 })).toBe("2 page(s), expected 1");
    expect(pageProblem(3, { min: 2 })).toBeNull();
    expect(pageProblem(1, { min: 2 })).toBe("1 page(s), expected 2+");
    expect(pageProblem(3, { min: 1, max: 2 })).toBe("3 page(s), expected 1-2");
  });
});

describe("textProblems", () => {
  const clean = "ORDER CONFIRMED ORD-1\nTotal $3,484.00";
  it("matches expected text across line breaks and case", () => {
    expect(textProblems(clean, { mustInclude: ["Order confirmed", "ORD-1 Total"] })).toEqual([]);
    expect(textProblems(clean, { mustInclude: ["Receipt"] })).toEqual(['missing text "Receipt"']);
  });
  it("flags redacted text that is present", () => {
    expect(textProblems("Billed to 100 Main St", { mustInclude: [], mustExclude: ["100 main st"] })).toEqual([
      'must not contain "100 main st"',
    ]);
  });
  it("flags template leaks", () => {
    const p = textProblems("Total $NaN for undefined &amp; ${x}", { mustInclude: [] });
    expect(p).toEqual(
      expect.arrayContaining([
        "template leak: NaN",
        "template leak: undefined",
        "template leak: HTML entity printed as text",
        "template leak: unrendered placeholder",
      ]),
    );
  });
  it("flags account lifecycle values but not ordinary order words", () => {
    expect(LIFECYCLE_TERMS).toContain("At Risk");
    expect(textProblems("Status At Risk", { mustInclude: [] })).toEqual(['account lifecycle value printed: "At Risk"']);
    expect(textProblems("STATUS AT RISK", { mustInclude: [] })).toEqual(['account lifecycle value printed: "At Risk"']);
    expect(textProblems("Status Pending · Onboarding · Active", { mustInclude: [] })).toEqual([]);
  });
});

describe("parseVerifyOutput", () => {
  it("reads per-file results", () => {
    const out = [
      "== /tmp/x/a.pdf",
      "   untagged content: 0 · fonts: 6 (TrueType) · words 300",
      "   veraPDF PDF/UA-1: pass",
      "   PASS",
      "== /tmp/x/b.pdf",
      "   veraPDF PDF/UA-1: not run (set VERAPDF)",
      '   FAIL: Type 3 font: X; words extract split: "SOLUTI ON"',
    ].join("\n");
    const r = parseVerifyOutput(out);
    expect(r.get("a.pdf")).toEqual({ pass: true, problems: [], pdfua: "pass", fonts: "6 (TrueType)" });
    expect(r.get("b.pdf")).toMatchObject({ pass: false, pdfua: "not run", problems: ["Type 3 font: X", 'words extract split: "SOLUTI ON"'] });
  });
});

describe("storePdfCases", () => {
  const cases = storePdfCases();
  it("has unique names and builds every template with its own title and doc ID", () => {
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
    for (const c of cases) {
      expect(htmlTitle(c.html)).not.toBe("Digerati Experts");
      expect(c.mustInclude.length).toBeGreaterThan(0);
    }
    expect(new Set(cases.map((c) => c.kind))).toEqual(new Set(["quote", "order", "receipt", "solution"]));
  });
  it("escapes markup in client-supplied names", () => {
    const c = cases.find((x) => x.name === "quote-special-characters")!;
    expect(c.html).not.toContain("<Dental>");
    expect(c.html).toContain("&lt;Dental&gt;");
  });
});
