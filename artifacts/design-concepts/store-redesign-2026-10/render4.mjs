// Renders concept 4 section by section at 1440 / 768 / 390 (reveals forced on, one situation added so the floating bar shows).
import { chromium } from "playwright-core";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const url = "http://localhost:3000/artifacts/design-concepts/store-redesign-2026-10/4-apple.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 768, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: w === 390 ? 2 : 1 });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(url, { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1600);
  await p.screenshot({ path: path.join(here, "renders", `4-apple-${w}-0-fold.png`) });
  await p.evaluate(() => document.querySelectorAll(".rv").forEach(e => e.classList.add("in")));
  await p.locator(".gcard .plus").nth(1).click(); await p.locator("#d-users").fill("25"); await p.locator("#d-monitor").fill("30");
  await p.waitForTimeout(1000);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  // Section shots without the fixed/sticky chrome stamped over them.
  await p.addStyleTag({ content: ".lnav{position:static!important}.bag{display:none!important}" });
  let i = 1;
  for (const sel of ["#situations", "#size", "#families", "#why", ".close"]) await p.locator(sel).screenshot({ path: path.join(here, "renders", `4-apple-${w}-${i++}-${sel.replace(/[#.]/, "")}.png`) });
  // The floating Your Solution bar in place, over the families.
  await p.addStyleTag({ content: ".bag{display:flex!important}" });
  await p.locator("#families").scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(here, "renders", `4-apple-${w}-6-bar.png`) });
  console.log(w, "overflow", over, errs.join("|"));
  await p.close();
}
await b.close();
