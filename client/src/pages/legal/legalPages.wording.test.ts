import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { legalMarkdownPlainText, parseLegalMarkdown } from "./LegalMarkdown";

const DIR = join(import.meta.dirname, "content");

function load(name: string): string {
  return readFileSync(join(DIR, name), "utf8");
}

const FILES = [
  "P-01-website-terms-of-use.md",
  "P-02-privacy-policy.md",
  "P-03-cookie-and-tracking-notice.md",
  "P-04-ai-use-disclosure.md",
  "P-05-accessibility-statement.md",
  "P-06-subprocessor-list.md",
  "P-07-acceptable-use-policy.md",
  "P-08-vulnerability-disclosure-policy.md",
];

describe("published legal wording", () => {
  it("keeps every visible placeholder and omits the unpublished draft notes", () => {
    const all = FILES.map(load).join("\n");
    expect(all).not.toMatch(/Draft v2026\.11 — not published/);
    expect(all).not.toMatch(/\*\*Implementation:\*\*/);

    const placeholders = [
      "{{PUBLISH_DATE}}",
      "{{DMCA_AGENT_NAME_AND_ADDRESS}}",
      "{{PUBLIC_PHONE}}",
      "{{MAILING_ADDRESS}}",
      "{{AI_PROVIDER_NAMING}}",
      "{{CHAT_RETENTION}}",
      "{{OPT_OUT_KEY}}",
      "{{VERIFIED_SECURITY_DETAILS",
      "{{LAST_AUDIT_DATE}}",
      "{{AUDIT_METHOD",
      "{{KNOWN_LIMITATIONS",
      "{{ACCESSIBILITY_EMAIL}}",
      "{{SUBPROCESSOR_NOTICE_DAYS}}",
      "{{SPEECH_PROVIDER}}",
      "{{PASSWORD_VAULT_VENDOR}}",
      "{{PGP_KEY_URL}}",
    ];
    for (const token of placeholders) {
      expect(all, token).toContain(token);
    }
  });

  it("retains the Arizona breach statute and does not claim a 99.9% SOC or PCI service-provider status in the new terms", () => {
    const terms = load("P-01-website-terms-of-use.md");
    const privacy = load("P-02-privacy-policy.md");
    expect(terms).not.toMatch(/99\.9%/);
    expect(terms).not.toMatch(/15-minute/);
    expect(terms).not.toMatch(/PCI DSS compliance as a service provider/i);
    expect(terms).toContain("These Terms do not promise any service level, response time, monitoring or security outcome.");
    expect(privacy).toContain("A.R.S. § 18-552");
    expect(privacy).toContain("Director of the Arizona Department of Homeland Security");
    expect(privacy).not.toContain("18-545");
  });

  it("parses headings, tables, and lists without dropping body text", () => {
    const privacy = load("P-02-privacy-policy.md");
    const blocks = parseLegalMarkdown(privacy);
    expect(blocks.some((b) => b.type === "h2" && b.text === "6. DE Desk chat and the homepage service matcher")).toBe(true);
    expect(blocks.some((b) => b.type === "table")).toBe(true);
    const plain = legalMarkdownPlainText(privacy);
    expect(plain).toContain("{{CHAT_RETENTION}}");
    expect(plain).toContain("We honor Global Privacy Control (GPC) browser signals");
  });
});
