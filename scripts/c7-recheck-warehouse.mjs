#!/usr/bin/env node
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://127.0.0.1:3300";
const route = "/internal/warehouse/co-managed?category=digital_assessments";
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i;
const b = await chromium.launch({ headless: true });
const img404 = [];
for (const vp of [{ n: 390, w: 390, h: 844, m: true }, { n: 1440, w: 1440, h: 900, m: false }]) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  p.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && (IMAGE_EXT.test(u) || /\/images\//.test(u))) img404.push({ vp: vp.n, u, status: r.status() });
  });
  await p.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(2500);
  const broken = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:")).map((i) => i.currentSrc || i.src));
  console.log(JSON.stringify({ vp: vp.n, broken: broken.length, sample: broken.slice(0, 3) }));
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({ img404Count: img404.length, img404: img404.slice(0, 10) }));
process.exit(img404.length === 0 ? 0 : 1);
