// Plate band evidence: each page scrolled so its band sits mid-viewport, at 1440 and 390, plus overflow and band count.
import { chromium } from "playwright-core";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const base = process.env.BASE || "http://127.0.0.1:3300";
const pages = (process.env.PAGES || "/solutions,/solutions/managed-workplace,/solutions/threat-detection,/solutions/co-managed-it,/solutions/standalone-services,/solutions/backup-disaster-recovery,/pricing,/industries/healthcare,/industries/law-firms,/industries/animal-hospitals,/about/mission-values").split(",");
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("de_cookie_consent_v2", JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() })); localStorage.setItem("de_cookie_consent", "declined"); } catch {} });
  for (const route of pages) {
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(base + route, { waitUntil: "networkidle" });
    const n = await p.evaluate(() => document.querySelectorAll(".de-plate-band").length);
    if (n) {
      await p.evaluate(() => { const el = document.querySelector(".de-plate-band"); scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.3); });
      await p.waitForTimeout(1200);
    }
    const name = route.slice(1).replace(/\//g, "-");
    await p.screenshot({ path: path.join(here, `${w}-${name}.png`) });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(w, route, "bands", n, "overflow", over, errs.join(" | "));
    await p.close();
  }
  await ctx.close();
}
await b.close();
