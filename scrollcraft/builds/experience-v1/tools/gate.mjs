/**
 * Release gate for Experience v1 (Joe's verdict, 2026-09-03). A run fails on:
 *
 *   - any scroll stop (every 10% of a viewport, first to last pixel) without
 *     at least one line of story copy readable: ≥ 70% inside the viewport,
 *     effective opacity ≥ 0.95, not inside an inert movement
 *   - any keyboard focus that lands outside the viewport or on an inert control
 *   - horizontal overflow
 *   - a first screen without the thesis H1 and a visible, tappable
 *     assessment control
 *   - flow mode (phones, reduced motion) that still pins, hides copy, or
 *     fails to show its stills
 *   - missing landmarks (header, main, nav, footer), more than one h1, or a
 *     heading order that does not start with it
 *   - console errors
 *   - a contrast proxy below 4.5:1 for copy over the world (text colour
 *     against the darker fifth of the pixels behind the line)
 *
 * Writes screenshots and report.json under OUT.
 *
 *   node scrollcraft/builds/experience-v1/tools/gate.mjs   (build served at BASE)
 *
 * Not covered here, by design: Safari/WebKit, a real GPU, a real phone's
 * touch scrolling, and the booking flow beyond the link target.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:4501/";
const OUT = process.env.OUT || "scrollcraft/builds/experience-v1/lab/gate";
const FFMPEG = process.env.FFMPEG || "/root/.cache/scrollcraft/node_modules/ffmpeg-static/ffmpeg";
const RUNS = [
  { name: "desktop-1440", w: 1440, h: 900 },
  { name: "tablet-768", w: 768, h: 1024 },
  { name: "phone-390", w: 390, h: 844, mobile: true },
  { name: "phone-360", w: 360, h: 800, mobile: true },
  { name: "desktop-1440-reduced", w: 1440, h: 900, reduce: true },
  { name: "phone-390-reduced", w: 390, h: 844, mobile: true, reduce: true },
];
mkdirSync(OUT, { recursive: true });

const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
function bgLuminance(png, rect) {
  const gray = execFileSync(FFMPEG, ["-loglevel", "error", "-f", "png_pipe", "-i", "pipe:0", "-vf", `crop=${rect.w}:${rect.h}:${rect.x}:${rect.y}`, "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { input: png, maxBuffer: 64 * 1024 * 1024 });
  const arr = Array.from(gray).sort((a, b) => a - b);
  const v = arr[Math.floor(arr.length * 0.2)] || 0; // the darker fifth is the ground behind the text
  return lum(v, v, v);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const report = [];
let failed = 0;
for (const run of RUNS) {
  const ctx = await browser.newContext({ viewport: { width: run.w, height: run.h }, deviceScaleFactor: 1, isMobile: !!run.mobile, hasTouch: !!run.mobile, reducedMotion: run.reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("x-flow") || document.documentElement.classList.contains("sc-ready"), null, { timeout: 30000 });
  const mode = await page.evaluate(() => (document.documentElement.classList.contains("x-flow") ? "flow" : "pin"));
  if (mode === "pin") await page.waitForFunction(() => document.getElementById("world").classList.contains("live"), null, { timeout: 30000 }).catch(() => errors.push("world never went live"));
  const liveMs = Date.now() - t0;
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  const fails = [];
  const F = (s) => fails.push(s);

  // structure and the first screen
  const structure = await page.evaluate(() => ({
    header: !!document.querySelector("header"), main: !!document.querySelector("main"), footer: !!document.querySelector("footer"), nav: !!document.querySelector("nav"),
    h1: document.querySelectorAll("h1").length, h1text: (document.querySelector("h1") || {}).textContent,
    headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.tagName),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    max: document.documentElement.scrollHeight - innerHeight, vh: innerHeight,
    cta: (() => { const a = document.querySelector("main a[href*='/book']"); if (!a) return null; const r = a.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), text: a.textContent.trim() }; })(),
    begin: (() => { const a = document.querySelector("#begin a.x-btn"); const r = a.getBoundingClientRect(); return r.top + scrollY; })(),
  }));
  if (!structure.header || !structure.main || !structure.footer || !structure.nav) F("landmarks missing: " + JSON.stringify({ header: structure.header, main: structure.main, nav: structure.nav, footer: structure.footer }));
  if (structure.h1 !== 1) F("h1 count " + structure.h1);
  if (!/drifting/.test(structure.h1text || "")) F("h1 is not the thesis: " + structure.h1text);
  if (structure.headings[0] !== "H1" || structure.headings.slice(1).some((h) => h === "H1")) F("heading order " + structure.headings.join(","));
  if (structure.overflow > 0) F("horizontal overflow " + structure.overflow + "px");
  if (!structure.cta || structure.cta.top < 0 || structure.cta.bottom > structure.vh || structure.cta.h < 44) F("first-screen assessment control not visible or not 44px tall: " + JSON.stringify(structure.cta));

  // every stop populated
  const step = Math.round(run.h * 0.1);
  const stops = [];
  for (let y = 0; y <= structure.max; y += step) stops.push(y);
  if (stops[stops.length - 1] !== structure.max) stops.push(structure.max);
  const blank = [];
  let minContrast = Infinity, contrastAt = null;
  for (let k = 0; k < stops.length; k++) {
    const y = stops[k];
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(mode === "pin" ? 320 : 120);
    const vis = await page.evaluate(() => {
      const vh = innerHeight;
      const eff = (el) => { let o = 1; for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === "hidden" || cs.display === "none" || n.inert) return 0; o *= parseFloat(cs.opacity); } return o; };
      const out = [];
      for (const el of document.querySelectorAll("main h1, main h2, main p, main blockquote, main li, main .x-block, main .x-band, main .x-rail > div, main .x-rows > div, main .x-still img")) {
        const isImg = el.tagName === "IMG";
        const t = isImg ? "[still: " + (el.getAttribute("alt") || "") + "]" : (el.innerText || "").trim();
        if (!isImg && t.length < 12) continue;
        const r = el.getBoundingClientRect(); if (r.height === 0) continue;
        const inter = Math.min(r.bottom, vh) - Math.max(r.top, 0); if (inter / r.height < (isImg ? 0.5 : 0.7)) continue;
        if (eff(el) < 0.95) continue;
        const cs = getComputedStyle(el);
        out.push({ tag: isImg ? "IMG" : el.tagName, text: t.slice(0, 60), rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, color: cs.color });
      }
      return out;
    });
    if (!vis.length) blank.push(y);
    if (k % 4 === 0 || !vis.length || k === stops.length - 1) {
      const png = await page.screenshot();
      writeFileSync(path.join(OUT, `${run.name}-y${String(y).padStart(5, "0")}.png`), png);
      if (vis.length && mode === "pin") {
        const el = vis.find((v) => v.tag === "P") || vis[0];
        const rect = { x: Math.max(0, el.rect.x), y: Math.max(0, el.rect.y), w: Math.min(el.rect.w, run.w - Math.max(0, el.rect.x)), h: Math.min(el.rect.h, run.h - Math.max(0, el.rect.y)) };
        if (rect.w > 4 && rect.h > 4) {
          const m = el.color.match(/\d+/g).map(Number);
          const c = contrast(lum(m[0], m[1], m[2]), bgLuminance(png, rect));
          if (c < minContrast) { minContrast = c; contrastAt = { y, text: el.text, c: +c.toFixed(2) }; }
        }
      }
    }
  }
  if (blank.length) F("blank stops at y=" + blank.join(","));
  if (mode === "pin" && minContrast < 4.5) F("contrast proxy " + minContrast.toFixed(2) + " at " + JSON.stringify(contrastAt));

  // flow mode: no pin, all copy present, stills shown
  let stills = null;
  if (mode === "flow") {
    const flow = await page.evaluate(() => ({
      pinned: !!document.querySelector(".sc-act--pinned"),
      hidden: [...document.querySelectorAll("main [data-sc-cue]")].filter((el) => getComputedStyle(el).opacity !== "1" || el.closest("[inert]")).length,
      stills: [...document.querySelectorAll(".x-still img")].map((i) => ({ shown: getComputedStyle(i).display !== "none" && i.getBoundingClientRect().width > 0, ok: i.complete && i.naturalWidth > 0, src: i.currentSrc.split("/").pop() })),
    }));
    if (flow.pinned) F("flow mode still pins");
    if (flow.hidden) F("flow mode hides " + flow.hidden + " copy elements");
    if (flow.stills.length < 3 || flow.stills.some((s) => !s.shown || !s.ok)) F("flow stills missing: " + JSON.stringify(flow.stills));
    stills = flow.stills.map((s) => s.src);
  }

  // keyboard: every focus lands inside the viewport, never on an inert control
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
  const focusPath = [];
  const offscreen = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(mode === "pin" ? 260 : 120);
    const a = await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const r = el.getBoundingClientRect(); return { tag: el.tagName, text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, inert: !!el.closest("[inert]") }; });
    if (!a) break;
    focusPath.push(a.text);
    if (a.top < 0 || a.bottom > a.vh || a.inert) offscreen.push(a);
    if (/digeratiexperts\.com$/.test(a.text)) break;
  }
  if (offscreen.length) F("focus outside the viewport: " + JSON.stringify(offscreen.slice(0, 4)));
  if (errors.length) F("console: " + errors.slice(0, 3).join(" | "));

  const journey = { pageVh: +((structure.max + structure.vh) / structure.vh).toFixed(2), decisionVh: +(structure.begin / structure.vh).toFixed(2), stops: stops.length };
  report.push({ run: run.name, mode, liveMs, journey, stills, focusPath, minContrast: mode === "pin" && isFinite(minContrast) ? +minContrast.toFixed(2) : null, contrastAt, fails });
  if (fails.length) failed++;
  console.log(`${run.name} [${mode}${mode === "pin" ? ", live " + liveMs + " ms" : ""}] page ${journey.pageVh} vh, decision at ${journey.decisionVh} vh, ${stops.length} stops, focus ${focusPath.length} stops${mode === "pin" && isFinite(minContrast) ? ", contrast ≥ " + minContrast.toFixed(2) : ""}: ${fails.length ? "FAIL\n  - " + fails.join("\n  - ") : "PASS"}`);
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(failed ? `\n${failed} run(s) failed` : "\nall runs passed");
process.exit(failed ? 1 : 0);
