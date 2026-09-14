#!/usr/bin/env node
/**
 * C5 — Fail the build if client/src references @assets/… or /images/…
 * string literals that do not resolve to a file on disk.
 *
 * @assets/X → attached_assets/X (unless vite has a dedicated alias)
 * /images/X → client/public/images/X
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "client", "src");
const ATTACHED = path.join(ROOT, "attached_assets");
const PUBLIC_IMAGES = path.join(ROOT, "client", "public", "images");

/** Dedicated Vite aliases that intentionally bypass attached_assets/. */
const ASSET_ALIASES = new Map([
  [
    "DE-Logo-new_1762461524794.webp",
    path.join(ROOT, "brand", "digerati-logo-reverse.svg"),
  ],
]);

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (CODE_EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

function resolveAsset(rel) {
  const aliased = ASSET_ALIASES.get(rel);
  if (aliased) return aliased;
  return path.join(ATTACHED, ...rel.split("/"));
}

function resolveImage(rel) {
  return path.join(PUBLIC_IMAGES, ...rel.split("/"));
}

const assetRe = /@assets\/([^"'`\s)?#]+)/g;
const imageRe = /["'`](\/images\/[^"'`?#\s]+)["'`]/g;

const missing = [];
const checked = { assets: new Set(), images: new Set() };

for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  const relFile = path.relative(ROOT, file).replace(/\\/g, "/");

  for (const m of text.matchAll(assetRe)) {
    const rel = m[1].replace(/\\/g, "/");
    checked.assets.add(rel);
    const target = resolveAsset(rel);
    if (!existsSync(target)) {
      missing.push({ kind: "@assets", ref: `@assets/${rel}`, file: relFile, expected: path.relative(ROOT, target).replace(/\\/g, "/") });
    }
  }

  for (const m of text.matchAll(imageRe)) {
    let rel = m[1];
    // Strip leading /images/
    rel = rel.replace(/^\/images\//, "");
    // Skip templates, docs ellipsis, and incomplete placeholders
    if (
      rel.includes("${") ||
      rel.includes("{") ||
      rel.includes("…") ||
      rel === "..." ||
      rel.startsWith("...") ||
      /\.\.\./.test(rel)
    ) {
      continue;
    }
    checked.images.add(rel);
    const target = resolveImage(rel);
    if (!existsSync(target)) {
      missing.push({
        kind: "/images",
        ref: `/images/${rel}`,
        file: relFile,
        expected: path.relative(ROOT, target).replace(/\\/g, "/"),
      });
    }
  }
}

if (missing.length) {
  console.error(`check-asset-imports: ${missing.length} missing asset(s):\n`);
  for (const row of missing) {
    console.error(`  ${row.ref}`);
    console.error(`    from ${row.file}`);
    console.error(`    expected ${row.expected}`);
  }
  process.exit(1);
}

console.log(
  `check-asset-imports: ok (${checked.assets.size} @assets, ${checked.images.size} /images literals)`,
);
