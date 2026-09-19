#!/usr/bin/env node
/**
 * B-5 — Render per-route OG images (1200×630) from the branded HTML template.
 * No AI. Requires playwright.
 *
 * Usage:
 *   node scripts/render-route-og.mjs
 *   node scripts/render-route-og.mjs --out client/public/images/og
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "scripts/og/route-og-template.html");

/** Top marketing + portal routes (extend as needed). */
const ROUTES = [
  { path: "/", title: "Managed IT & cybersecurity", theme: "paper", file: "home" },
  { path: "/about", title: "About Digerati Experts", theme: "paper", file: "about" },
  { path: "/about/team", title: "Meet the team", theme: "paper", file: "about-team" },
  { path: "/store", title: "Technology store", theme: "paper", file: "store" },
  { path: "/resources/blog", title: "Journal", theme: "paper", file: "blog" },
  { path: "/portal/login", title: "Client portal", theme: "graphite", file: "portal-login" },
  { path: "/portal/dashboard", title: "Portal dashboard", theme: "graphite", file: "portal-dashboard" },
];

function parseArgs(argv) {
  const outIdx = argv.indexOf("--out");
  return {
    outDir: path.resolve(
      ROOT,
      outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1] : "client/public/images/og",
    ),
  };
}

async function main() {
  const { outDir } = parseArgs(process.argv.slice(2));
  await mkdir(outDir, { recursive: true });
  const template = await readFile(TEMPLATE, "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const manifest = [];

  for (const route of ROUTES) {
    const html = template
      .replaceAll("{{THEME}}", route.theme)
      .replaceAll("{{TITLE}}", route.title)
      .replaceAll("{{PATH}}", route.path);
    await page.setContent(html, { waitUntil: "load" });
    const file = `${route.file}.png`;
    const dest = path.join(outDir, file);
    await page.screenshot({ path: dest, type: "png" });
    manifest.push({ ...route, file: `/images/og/${file}` });
    console.log(`ok ${route.path} → ${file}`);
  }

  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await browser.close();
  console.log(`wrote ${manifest.length} OG images to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
