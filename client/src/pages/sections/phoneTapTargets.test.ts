import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phone tap targets on the live homepage, measured at 390px on a production
 * build (2026-10-01). Vitest runs in node here, so these read the sources.
 */
const read = (name: string) => readFileSync(resolve(__dirname, name), "utf8");

describe("homepage phone tap targets", () => {
  it("keeps the footer email field 44px tall when the form stacks on a phone", () => {
    // In the stacked (flex-col) form a bare flex-1 made the field's flex-basis
    // 0 on the vertical axis, collapsing it to 22px despite h-11.
    const footer = read("DigeratiEnhancedFooterSection.tsx");
    const field = footer.match(/id="footer-newsletter-email"[\s\S]*?className="([^"]+)"/)?.[1] ?? "";
    expect(field).toMatch(/\bmin-h-11\b/);
    expect(field.split(/\s+/)).not.toContain("flex-1");
    expect(field).toMatch(/\bsm:flex-1\b/);
  });

  it("gives footer links a hit area that fills their row gap without moving the layout", () => {
    const footer = read("DigeratiEnhancedFooterSection.tsx");
    const link = footer.match(/const FooterLink[\s\S]*?className="([^"]+)"/)?.[1] ?? "";
    expect(link).toMatch(/\binline-block\b/);
    expect(link).toMatch(/\bpy-1\b/);
    expect(link).toMatch(/(^|\s)-my-1(\s|$)/);
  });

  it("makes the trust links under the reviews 44px tall on a phone", () => {
    const proof = read("DigeratiTestimonialsSection.tsx");
    for (const href of ["/about/client-bill-of-rights", "/about/guarantee", "/trust/trust-center", "/industries/healthcare"]) {
      expect(proof, href).toContain(`<Link href="${href}" className="inline-flex items-center max-md:min-h-11">`);
    }
  });

  it("makes the industry slider arrows 44px", () => {
    const industries = read("DigeratiIndustriesSection.tsx");
    expect(industries.match(/z-20 w-11 h-11 rounded-full/g)?.length).toBe(2);
    expect(industries).not.toMatch(/z-20 w-10 h-10 rounded-full/);
  });

  it("makes the threat-feed carousel arrows 44px", () => {
    // Only rendered when the feed has recent items, so a local build without
    // the feed never shows them; production's homepage feed does.
    const threats = read("DigeratiThreatsInsightsSection.tsx");
    expect(threats.match(/z-20 w-11 h-11 rounded-full/g)?.length).toBe(2);
    expect(threats).not.toMatch(/z-20 w-10 h-10 rounded-full/);
  });
});
