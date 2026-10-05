// Site atmosphere evidence: each page's fold, and the same page scrolled 600px so the parallax offset is visible, at 1440 and 390.
import { chromium } from "playwright-core";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const base = process.env.BASE || "http://127.0.0.1:3300";
const pages = (process.env.PAGES || "/,/solutions,/pricing,/industries,/about/mission,/contact,/resources,/industries/healthcare").split(",");
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("de_cookie_consent_v2", JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() })); localStorage.setItem("de_cookie_consent", "declined"); } catch {} });
  for (const route of pages) {
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(base + route, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    const name = route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
    await p.screenshot({ path: path.join(here, `${w}-${name}-a.png`) });
    await p.mouse.wheel(0, 700); await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(here, `${w}-${name}-b.png`) });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const layers = await p.evaluate(() => document.querySelectorAll(".de-px-layer").length);
    console.log(w, route, "overflow", over, "layers", layers, errs.join(" | "));
    await p.close();
  }
  await ctx.close();
}
await b.close();
