import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Customer-facing portal copy must not use bare "Digerati" as the company
 * label (.cursor/rules/digerati-naming.mdc). Prefer DE or Digerati Experts.
 */
const read = (name: string) => readFileSync(resolve(__dirname, name), "utf8");

/** Preposition + Digerati not followed by Experts, Journal, admin, or Expert (product). */
const BARE_COMPANY_DIGERATI =
  /\b(with|from|to|for|ask|before|about)\s+Digerati\b(?!\s+(Experts|Journal|admin|Expert))/gi;

const GUARDED_PORTAL_SOURCES = [
  "PortalInfrastructure.tsx",
  "PortalApprovals.tsx",
] as const;

describe("portal company naming", () => {
  for (const file of GUARDED_PORTAL_SOURCES) {
    it(`does not use bare Digerati as the company label in ${file}`, () => {
      const source = read(file);
      const hits = [...source.matchAll(BARE_COMPANY_DIGERATI)].map((m) => m[0]);
      expect(hits, `Use DE or Digerati Experts instead of: ${hits.join(", ")}`).toEqual([]);
    });
  }
});
