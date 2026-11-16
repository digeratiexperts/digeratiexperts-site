import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANY } from "./companyContact";

const ROOT = join(import.meta.dirname, "..");
const INFO_MAILBOX = "info@" + "digeratiexperts.com";

/** Files shipped with the site: HTML, JSON-LD, well-known, llms.txt, and app source. */
const SERVED_ROOTS = [
  "client/index.html",
  "client/public",
  "client/src",
  "public",
];

function walk(target: string, acc: string[] = []): string[] {
  const st = statSync(target);
  if (st.isDirectory()) {
    for (const name of readdirSync(target)) {
      if (name === "node_modules" || name === "dist") continue;
      walk(join(target, name), acc);
    }
  } else if (/\.(ts|tsx|js|mjs|html|txt|json|xml|svg)$/i.test(target)) {
    acc.push(target);
  }
  return acc;
}

describe("public mailbox routing", () => {
  it("keeps the public general inbox on admin@, not info@", () => {
    expect(COMPANY.email).toBe("admin@digeratiexperts.com");
    expect(COMPANY.email).not.toContain(INFO_MAILBOX);
  });

  it("sends AUP abuse reports to security@ and document requests to legal@", () => {
    const aup = readFileSync(join(ROOT, "client/src/pages/legal/AUP.tsx"), "utf8");
    expect(aup).toContain("Reporting Abuse");
    expect(aup).toContain("mailto:${COMPANY.securityEmail}?subject=Abuse");
    expect(aup).toContain("mailto:${COMPANY.legalEmail}?subject=AUP Request");
    expect(aup).not.toContain(INFO_MAILBOX);
  });

  it("does not serve info@ in public site files", () => {
    const hits: string[] = [];
    for (const entry of SERVED_ROOTS) {
      const target = join(ROOT, entry);
      const files = statSync(target).isDirectory() ? walk(target) : [target];
      for (const file of files) {
        const rel = relative(ROOT, file).replace(/\\/g, "/");
        if (/\.test\.(ts|tsx|js|mjs)$/.test(rel)) continue;
        const text = readFileSync(file, "utf8");
        if (text.includes(INFO_MAILBOX)) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
