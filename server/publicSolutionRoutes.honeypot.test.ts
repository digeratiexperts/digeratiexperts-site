// The public solution request's honeypot fields (company_website, website, fax)
// are hidden from people. Any value there marks a bot. A string-only check let a
// JSON number or boolean through (2026-11-06 backlog).
import { describe, expect, it } from "vitest";
import { honeypotTripped } from "./publicSolutionRoutes";

describe("honeypotTripped", () => {
  it("is not tripped by an empty or absent honeypot", () => {
    expect(honeypotTripped({})).toBe(false);
    expect(honeypotTripped({ website: "" })).toBe(false);
    expect(honeypotTripped({ website: "   " })).toBe(false);
    expect(honeypotTripped({ company_website: null, fax: undefined })).toBe(false);
    expect(honeypotTripped(undefined)).toBe(false);
    expect(honeypotTripped("not an object")).toBe(false);
  });

  it("is tripped by a filled string in any honeypot field", () => {
    expect(honeypotTripped({ website: "https://spam.example" })).toBe(true);
    expect(honeypotTripped({ company_website: "x" })).toBe(true);
    expect(honeypotTripped({ fax: "555-0100" })).toBe(true);
  });

  it("is tripped by a filled non-string value", () => {
    expect(honeypotTripped({ website: 1 })).toBe(true);
    expect(honeypotTripped({ website: 0 })).toBe(true);
    expect(honeypotTripped({ fax: true })).toBe(true);
    expect(honeypotTripped({ company_website: ["spam"] })).toBe(true);
    expect(honeypotTripped({ website: { url: "x" } })).toBe(true);
  });

  it("ignores fields that are not honeypots", () => {
    expect(honeypotTripped({ organizationName: "Acme", contactEmail: "a@example.com" })).toBe(false);
  });
});
