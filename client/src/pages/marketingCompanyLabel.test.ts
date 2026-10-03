import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Customer-facing marketing copy must not use bare "Digerati" as the company
 * label (.cursor/rules/digerati-naming.mdc). Prefer DE or Digerati Experts.
 * Product names such as "Digerati Journal" and pronunciation of the word are
 * out of scope for this guard.
 */
const read = (...parts: string[]) =>
  readFileSync(resolve(__dirname, ...parts), "utf8");

/** Bare company label: Digerati not followed by Experts / Journal / Expert. */
const BARE_COMPANY_DIGERATI =
  /\bDigerati\b(?!\s+(Experts|Journal|Expert))/g;

const GUARDED_SOURCES = [
  ["industries", "Healthcare.tsx"],
  ["industries", "Accounting.tsx"],
  ["sections", "HomepageTrustRail.tsx"],
  ["resources", "Ebook.tsx"],
  ["trust", "TrustCenter.tsx"],
  ["about", "ComplianceCertifications.tsx"],
  ["NetworkPlannerOfficial.tsx"],
] as const;

describe("marketing company naming", () => {
  for (const parts of GUARDED_SOURCES) {
    const label = parts.join("/");
    it(`does not use bare Digerati as the company label in ${label}`, () => {
      const source = read(...parts);
      const hits = [...source.matchAll(BARE_COMPANY_DIGERATI)].map((m) => {
        const start = Math.max(0, (m.index ?? 0) - 24);
        const end = Math.min(source.length, (m.index ?? 0) + m[0].length + 24);
        return source.slice(start, end).replace(/\s+/g, " ").trim();
      });
      expect(
        hits,
        `Use DE or Digerati Experts instead of bare Digerati near: ${hits.join(" | ")}`,
      ).toEqual([]);
    });
  }
});
