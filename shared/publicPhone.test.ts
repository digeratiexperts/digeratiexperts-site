import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PHONE_REGISTRY, PRIMARY_PHONE } from "./companyContact";

const ROOT = join(import.meta.dirname, "..");
const SCAN_DIRS = ["client/src", "server", "shared"];
const ALLOW_325 = new Set([
  "shared/companyContact.ts",
  "shared/publicPhone.test.ts",
  "client/src/data/companyContact.ts",
  "client/src/data/companyContact.test.ts",
  "server/services/msp-advisor/msp-advisor.test.ts",
]);

const BANNED_480 = [
  "480-519-5892",
  "(480) 519-5892",
  "4805195892",
  "+14805195892",
  "tel:+14805195892",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

const repoPath = (file: string): string => relative(ROOT, file).replaceAll("\\", "/");

describe("public phone NAP", () => {
  it("exposes one primary number", () => {
    expect(PRIMARY_PHONE.display).toBe("325-480-9870");
    expect(Object.keys(PHONE_REGISTRY)).toEqual(["primary"]);
  });

  it("does not publish a second unlabeled public number in app source", () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = repoPath(file);
        if (rel === "shared/publicPhone.test.ts") continue;
        const text = readFileSync(file, "utf8");
        for (const needle of BANNED_480) {
          if (text.includes(needle)) hits.push(`${rel}: ${needle}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps 325-480-9870 only in the canonical contact module and tests", () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = repoPath(file);
        if (ALLOW_325.has(rel)) continue;
        const text = readFileSync(file, "utf8");
        if (text.includes("325-480-9870") || text.includes("tel:+13254809870")) {
          hits.push(rel);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
