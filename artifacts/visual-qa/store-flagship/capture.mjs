// Captures the live-build /store (flagship) section by section at 1440 / 768 / 390 from a local production server.
import { chromium } from "playwright-core";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const base = process.env.BASE || "http://127.0.0.1:3300";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 768, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: w === 390 ? 2 : 1 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${base}/store`, { waitUntil: "networkidle" });
  const accept = p.getByRole("button", { name: "Accept All" });
  await accept.first().waitFor({ timeout: 5000 }).catch(() => {});
  if (await accept.count()) await accept.first().click();
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(here, `${w}-0-fold.png`) });
  await p.evaluate(() => document.querySelectorAll("[data-d2-reveal]").forEach((e) => (e.dataset.d2Reveal = "in")));
  await p.locator("[data-testid='scenario-it-person-left-action']").click();
  await p.waitForTimeout(800);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // Section shots without the fixed chrome (site nav, dock, bar) stamped over them.
  await p.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) if (getComputedStyle(el).position === "fixed") el.setAttribute("data-cap-hide", "");
    const style = document.createElement("style");
    style.textContent = "[data-cap-hide]{visibility:hidden!important}";
    document.head.append(style);
    document.querySelector(".d2-flag-lnav").style.position = "static";
  });
  let i = 1;
  for (const sel of ["#situations", "#profile", "#families", "#why", ".d2-flag-close"]) await p.locator(sel).screenshot({ path: path.join(here, `${w}-${i++}-${sel.replace(/^[#.]/, "")}.png`) });
  console.log(w, "overflow", over, errs.join(" | "));
  await p.close();
}
await b.close();
