import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findHeldGcchPricingViolations } from "../shared/gcchPricingHold";

const ROOT = path.resolve(import.meta.dirname, "..");

const SCAN_ROOTS = [
  "client/src",
  "public",
  "shared",
  "server",
  "scripts/de-documents/content",
  "scrollcraft/builds",
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "artifacts",
  "attached_assets",
  "dist",
  "build",
  "coverage",
  "fonts",
  "img",
  "assets",
]);

const SKIP_FILES = new Set([
  "gcchPricingHold.ts",
  "gcchPricingHold.test.ts",
  "gcch-pricing-hold.served.test.ts",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".json",
  ".md",
  ".txt",
  ".html",
  ".xml",
  ".css",
  ".mdx",
]);

function shouldScanFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (SKIP_FILES.has(base)) return false;
  if (base.endsWith(".min.js") || base.endsWith(".lock")) return false;
  if (/\.test\.(ts|tsx|js|mjs|mts)$/.test(base)) return false;
  return TEXT_EXTENSIONS.has(path.extname(base));
}

function walk(dir: string, found: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, found);
      continue;
    }
    if (shouldScanFile(full)) found.push(full);
  }
}

describe("served GCC High pricing hold", () => {
  it("fails if a held GCC High dollar price is present in served or public copy", () => {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
      walk(path.join(ROOT, root), files);
    }
    expect(files.length).toBeGreaterThan(20);

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const hits = findHeldGcchPricingViolations(content);
      if (hits.length === 0) continue;
      const rel = path.relative(ROOT, file).replaceAll("\\", "/");
      for (const hit of hits) {
        violations.push(`${rel}: ${hit}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
