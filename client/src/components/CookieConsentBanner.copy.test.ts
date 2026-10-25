import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The full disclosure paragraph covered about a fifth of a 1440x900 screen and
 * sat on the homepage hero buttons (live check 2026-10-20). The banner is now one
 * short line at every width, the same on the dark site and the light Store.
 */
const src = readFileSync(new URL("./CookieConsentBanner.tsx", import.meta.url), "utf8");

describe("cookie consent banner copy", () => {
  it("no longer renders the long disclosure paragraph at any width", () => {
    expect(src).not.toContain("uses cookies and similar tracking technologies");
    expect(src).not.toContain("hidden xl:block");
  });

  it("states what the cookies are for, what Accept All means, and links the policy", () => {
    expect(src).toContain("We use cookies to run the site, measure visits and support our marketing.");
    expect(src).toContain("Accept All allows all of them.");
    expect(src).toContain('href="/legal/privacy-policy"');
    expect(src).toContain('data-testid="link-privacy-policy-cookie"');
  });

  it("uses one layout for the dark site and the light Store; only the colours differ", () => {
    const text = src.slice(src.indexOf('data-testid="cookie-consent-text"') - 400, src.indexOf('data-testid="cookie-consent-text"'));
    expect(text).not.toMatch(/light \? "hidden"/);
    expect(src).toContain('data-testid="button-reject-all-cookies"');
    expect(src).toContain('data-testid="button-accept-all-cookies"');
    expect(src).toContain('data-testid="button-manage-cookie-preferences"');
  });
});
