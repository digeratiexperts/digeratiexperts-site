#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.resolve("C:/Users/Joe/DE/Evidence/2026-09-12-claude-c1/b2-b5");
const repo = path.resolve(
  "C:/Users/Joe/DE/Repos/digeratiexperts-site-wt-seeded-admin",
);
const siteEvidence = path.join(repo, "client/public/images/evidence");
const ogOut = path.join(evidence, "b5-og-renders");
const siteOg = path.join(repo, "client/public/images/og");

await mkdir(ogOut, { recursive: true });
await mkdir(siteOg, { recursive: true });
await mkdir(siteEvidence, { recursive: true });

const browser = await chromium.launch();

{
  const html = await readFile(path.join(evidence, "b2-hero-desk-fixture.html"), "utf8");
  const page = await browser.newPage({
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  const png1440 = path.join(evidence, "hero-desk-1440.png");
  await page.screenshot({ path: png1440, type: "png" });
  await page.close();

  const page2x = await browser.newPage({
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 2,
  });
  await page2x.setContent(html, { waitUntil: "load" });
  const png2880 = path.join(evidence, "hero-desk-2880.png");
  await page2x.screenshot({ path: png2880, type: "png" });
  await page2x.close();

  await copyFile(png1440, path.join(siteEvidence, "hero-desk-1440.png"));
  await copyFile(png2880, path.join(siteEvidence, "hero-desk-2880.png"));
  console.log("B-2 png ok");
}

{
  const template = await readFile(
    path.join(repo, "scripts/og/route-og-template.html"),
    "utf8",
  );
  const routes = [
    { path: "/", title: "Managed IT & cybersecurity", theme: "paper", file: "home" },
    { path: "/about", title: "About Digerati Experts", theme: "paper", file: "about" },
    { path: "/about/team", title: "Meet the team", theme: "paper", file: "about-team" },
    { path: "/store", title: "Technology store", theme: "paper", file: "store" },
    { path: "/resources/blog", title: "Journal", theme: "paper", file: "blog" },
    { path: "/portal/login", title: "Client portal", theme: "graphite", file: "portal-login" },
    { path: "/portal/dashboard", title: "Portal dashboard", theme: "graphite", file: "portal-dashboard" },
  ];
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const manifest = [];
  for (const route of routes) {
    const html = template
      .replaceAll("{{THEME}}", route.theme)
      .replaceAll("{{TITLE}}", route.title)
      .replaceAll("{{PATH}}", route.path);
    await page.setContent(html, { waitUntil: "load" });
    const file = `${route.file}.png`;
    const destE = path.join(ogOut, file);
    const destS = path.join(siteOg, file);
    await page.screenshot({ path: destE, type: "png" });
    await copyFile(destE, destS);
    manifest.push({ ...route, file: `/images/og/${file}` });
    console.log("OG", route.path);
  }
  await writeFile(path.join(ogOut, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(siteOg, "manifest.json"), JSON.stringify(manifest, null, 2));
  await page.close();
}

await browser.close();
console.log("done");
