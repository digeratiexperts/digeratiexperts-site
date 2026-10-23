import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Guards for the rules in design/reference/homepage-v2/SWAP-PROMPT.md that are easy to break later. */
const here = import.meta.dirname;
const sectionsDir = path.join(here, "sections");
const sectionSources = readdirSync(sectionsDir).map((file) => ({
  file,
  text: readFileSync(path.join(sectionsDir, file), "utf8"),
}));
const everySource = [...sectionSources.map((s) => s.text), readFileSync(path.join(here, "HomepageV2.tsx"), "utf8")].join("\n");

describe("Homepage v2 content rules", () => {
  it("shows Joe's photo only in the Team section", () => {
    const withPhoto = sectionSources.filter((s) => s.text.includes("joe-petro-studio-blazer-white")).map((s) => s.file);
    expect(withPhoto).toEqual(["TeamSection.tsx"]);
  });

  it("never names a distributor", () => {
    expect(everySource).not.toMatch(/Pax8|Sherweb|Ingram|Griffin/i);
  });

  it("keeps the third lane name in one constant", () => {
    const literal = sectionSources.filter((s) => s.text.includes("Ready-to-Work IT") && s.file !== "ContactSection.tsx");
    // Copy that is a plain sentence may repeat the name; the heading must come from the constant.
    expect(literal.every((s) => !/<h3>Ready-to-Work IT<\/h3>/.test(s.text))).toBe(true);
    expect(readFileSync(path.join(here, "../../data/offering.ts"), "utf8")).toContain('THIRD_LANE_NAME = "Ready-to-Work IT"');
    expect(readFileSync(path.join(here, "content.ts"), "utf8")).toContain('from "@/data/offering"');
  });

  it("does not hotlink the reference's digeratiexperts.com assets", () => {
    expect(everySource).not.toMatch(/https:\/\/digeratiexperts\.com/);
  });

  it("uses the Assessment-first wording and no unqualified 24/7 monitoring claim", () => {
    expect(everySource).not.toMatch(/24\/7 monitoring(?! on Business)/i);
  });
});

describe("Homepage v2 stylesheet", () => {
  const css = readFileSync(path.join(here, "homepage-v2.css"), "utf8");
  const selectors = css
    .split("\n")
    .filter((line) => /\{\s*$/.test(line) && !line.trim().startsWith("@"))
    .flatMap((line) => line.replace(/\{\s*$/, "").split(","))
    .map((selector) => selector.trim())
    .filter(Boolean);

  it("scopes every selector under .hv2 so nothing leaks into site-wide CSS", () => {
    const unscoped = selectors.filter((selector) => !selector.startsWith(".hv2"));
    expect(unscoped).toEqual([]);
  });
});
