import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Customer-facing portal copy must not use bare "Digerati" as the company
 * label (.cursor/rules/digerati-naming.mdc). Prefer DE or Digerati Experts.
 */
const read = (name: string) => readFileSync(resolve(__dirname, name), "utf8");

/** Bare company label: Digerati not followed by Experts / Journal / Expert (product). */
const BARE_COMPANY_DIGERATI =
  /\bDigerati\b(?!\s+(Experts|Journal|Expert))/g;

const GUARDED_PORTAL_SOURCES = [
  "PortalInfrastructure.tsx",
  "PortalApprovals.tsx",
  "PortalPeople.tsx",
] as const;

describe("portal company naming", () => {
  for (const file of GUARDED_PORTAL_SOURCES) {
    it(`does not use bare Digerati as the company label in ${file}`, () => {
      const source = read(file);
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
