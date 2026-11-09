import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANY, PRIMARY_PHONE } from "@shared/companyContact";

/**
 * Joe, 2026-10-14: the footer shows the phone (tap-to-call) and the email
 * (mailto) on every page. Both live footers read them from companyContact,
 * so a number change cannot miss the footer. City only, no street (PR 532).
 */
const footers = {
  shared: "client/src/pages/sections/DigeratiEnhancedFooterSection.tsx",
  homepage: "client/src/pages/versions/v8/sections/16-contact-footer.tsx",
};
const read = (relative: string) => readFileSync(resolve(__dirname, "../../../..", relative), "utf8");

describe("footer phone and email", () => {
  for (const [name, relative] of Object.entries(footers)) {
    it(`${name} footer links the phone and email from the NAP source`, () => {
      const source = read(relative);
      const footer = source.slice(source.lastIndexOf("<footer"));
      // A raw <a> (homepage) or the shared FooterLink, which takes testId.
      expect(footer).toMatch(/href=\{PRIMARY_PHONE\.telHref\} (data-testid|testId)="footer-phone"/);
      expect(footer).toMatch(/href=\{`mailto:\$\{COMPANY\.email\}`\} (data-testid|testId)="footer-email"/);
      expect(footer).toContain("{PRIMARY_PHONE.display}");
      expect(footer).toContain("{COMPANY.email}");
      // No typed copies of the values, and no street or ZIP.
      expect(footer).not.toContain(PRIMARY_PHONE.display);
      expect(footer).not.toContain(COMPANY.email);
      expect(footer).not.toMatch(/Alma School|85248/);
    });
  }
});

/**
 * Door 2 (variant="store") never shows the word "SLA" in visible footer text
 * (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §12(a), §16.2). The default footer keeps the link.
 */
describe("store footer legal list", () => {
  it("hides the SLA link only for the store variant", () => {
    const source = read(footers.shared);
    expect(source).toMatch(/const STORE_HIDDEN_LEGAL = new Set\(\["SLA"\]\)/);
    expect(source).toMatch(/variant === "store" \? column\.links\.filter\(\(item\) => !STORE_HIDDEN_LEGAL\.has\(item\.name\)\) : column\.links/);
    expect(source).toContain('{ name: "SLA", href: "/legal/sla" }');
  });
});
