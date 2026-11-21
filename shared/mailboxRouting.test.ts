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
    const aupPage = readFileSync(join(ROOT, "client/src/pages/legal/AUP.tsx"), "utf8");
    const aup = readFileSync(join(ROOT, "client/src/pages/legal/content/P-07-acceptable-use-policy.md"), "utf8");
    const dpa = readFileSync(join(ROOT, "client/src/pages/legal/DPA.tsx"), "utf8");
    const msa = readFileSync(join(ROOT, "client/src/pages/legal/MSA.tsx"), "utf8");
    expect(aupPage).toContain("P-07-acceptable-use-policy.md");
    expect(aup).toContain("## 6. Reporting abuse");
    expect(aup).toContain(`Report abuse of DE services to ${COMPANY.securityEmail} with "Abuse" in the subject.`);
    expect(aup).not.toMatch(/Report abuse of DE services to admin@/);
    expect(aup).not.toContain(INFO_MAILBOX);
    expect(dpa).toContain(`mailto:${COMPANY.legalEmail}?subject=DPA Request`);
    expect(msa).toContain(`mailto:${COMPANY.legalEmail}?subject=MSA Request`);
    expect(dpa).not.toContain(INFO_MAILBOX);
    expect(msa).not.toContain(INFO_MAILBOX);
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
