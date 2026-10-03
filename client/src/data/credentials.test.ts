import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFIED_CREDENTIALS } from "./credentials";

/**
 * Credentials are claims about DE itself, so they come only from
 * credentials.ts, each with the issuer's own record (docs/CLAIMS-REGISTER.md,
 * "How to add a claim", rule 3). This test fails when a public page types a
 * certification, partner program or rating by name.
 */

const ROOT = path.resolve(__dirname, "../../..");

// Names the site previously showed without verification, plus close variants.
const CREDENTIAL_NAMES =
  /CISSP|\bCISM\b|CCSP|OSCP|GIAC|Certified Ethical Hacker|\bCEH\b|Security\+|CompTIA|\bMCSE\b|VMware (VCP|Certified)|AWS Certified|Azure (Administrator|Certified)|Google Partner|Microsoft Partner|Apple Consultants|BBB A\+|Better Business Bureau/;

// Noindex design previews and the internal sales playbook are not public
// marketing pages; the data file itself is the one allowed source.
const EXCLUDED = [
  "client/src/pages/versions/",
  "client/src/pages/portal/",
  "client/src/data/credentials.ts",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("published credentials", () => {
  it("every entry links to the issuer's own record and says when it was checked", () => {
    for (const c of VERIFIED_CREDENTIALS) {
      expect(c.verifyUrl, c.name).toMatch(/^https:\/\//);
      expect(c.verifyUrl, c.name).not.toMatch(/digeratiexperts\.com/);
      expect(c.checkedOn, c.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.name.trim(), "name").not.toBe("");
      expect(c.issuer.trim(), c.name).not.toBe("");
      expect(c.holder.trim(), c.name).not.toBe("");
    }
  });

  it("no public page names a credential outside credentials.ts", () => {
    const files = [
      ...sourceFiles(path.join(ROOT, "client/src/pages")),
      ...sourceFiles(path.join(ROOT, "client/src/components")),
    ];
    const offenders = files
      .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
      .filter((rel) => !EXCLUDED.some((prefix) => rel.startsWith(prefix)))
      .filter((rel) => CREDENTIAL_NAMES.test(readFileSync(path.join(ROOT, rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
