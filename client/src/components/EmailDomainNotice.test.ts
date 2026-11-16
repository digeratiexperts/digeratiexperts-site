import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("EmailDomainNotice", () => {
  it("sends visitors to the contact page, never to a phone number", () => {
    const src = fs.readFileSync(new URL("./EmailDomainNotice.tsx", import.meta.url), "utf8");
    expect(src).toContain('href="/contact"');
    expect(src).not.toMatch(/tel:|PRIMARY_PHONE|telHref/);
  });
});
