import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { spawn } from "node:child_process";

// Built-preview browser integration. Vendor requests are intercepted: verifies
// application commands and SDK loading boundaries, NOT Google event receipt.
// BASE_URL=http://127.0.0.1:4317 node scripts/ga4-browser-smoke.mjs
const base = process.env.BASE_URL || "http://127.0.0.1:4317";
const out = process.env.GA4_QA_DIR || "artifacts/qa/ga4-20261028";
await mkdir(out, { recursive: true });
let preview;
if (process.env.GA4_START_PREVIEW === "1") {
  preview = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", new URL(base).port, "--strictPort"], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve, reject) => {
    preview.stdout.on("data", chunk => { if (String(chunk).includes("Local:")) resolve(); });
    preview.on("exit", code => reject(new Error(`Preview exited: ${code}`)));
  });
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--use-gl=angle", "--use-angle=swiftshader", "--no-zygote"],
});
const results = [];
const vendor = /googletagmanager|google-analytics|clarity\.ms|facebook\.net|licdn\.com|bing\.com/;

async function session(consent) {
  const context = await browser.newContext();
  const requests = [];
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname === "portal.example.test") {
      const response = await route.fetch({ url: new URL(url.pathname + url.search, base).href });
      return route.fulfill({ response });
    }
    if (vendor.test(url.hostname)) requests.push({ host: url.hostname, path: url.pathname });
    // No telemetry leaves this test browser, and no real third-party SDK runs.
    return route.fulfill({ status: 200, contentType: "application/javascript", body: url.hostname === "bat.bing.com" ? "window.UET = class { push() {} };" : "" });
  });
  await context.addInitScript(value => {
    if (value) localStorage.setItem("de_cookie_consent_v2", JSON.stringify(value));
    window.__QA_DOCUMENT__ = Math.random().toString(36).slice(2);
  }, consent);
  return { context, page: await context.newPage(), requests };
}
async function closeSession(context) {
  await context.unrouteAll({behavior:"wait"});
  await context.close();
}
const views = page => page.evaluate(() => Array.from(window.dataLayer || [], x => Array.from(x)).filter(x => x[0] === "event" && x[1] === "page_view"));
const waitViews = (page, count) => page.waitForFunction(n => Array.from(window.dataLayer || []).filter(x => x[0] === "event" && x[1] === "page_view").length === n, count);
const navigate = (page, path) => page.evaluate(p => history.pushState({}, "", p), path);
const accepted = { analytics: true, marketing: false };

try {
  {
    const {context, page, requests} = await session();
    await page.goto(base); await page.locator("#home-main").waitFor();
    await page.getByTestId("cookie-consent-banner").waitFor();
    assert.equal((await views(page)).length, 0); assert.equal(requests.length, 0);
    await navigate(page, "/solutions");
    await page.waitForFunction(() => location.pathname === "/solutions" && !document.querySelector("[data-page-loading]"));
    await page.getByTestId("button-accept-all-cookies").click(); await waitViews(page, 1);
    const event = (await views(page))[0][2];
    assert.equal(event.page_path, "/solutions"); assert.equal(event.page_title, await page.title());
    assert.equal(requests.filter(x => x.host === "www.googletagmanager.com").length, 1);
    results.push({scenario:"no consent, navigate, then grant",passed:true}); await closeSession(context);
  }
  {
    const {context, page, requests} = await session(accepted);
    await page.goto(base); await waitViews(page, 1);
    assert.equal((await views(page))[0][2].page_title, await page.title());
    const id = await page.evaluate(() => window.__QA_DOCUMENT__);
    await navigate(page, "/contact"); await waitViews(page, 2);
    assert.equal((await views(page))[1][2].page_title, await page.title());
    assert.equal((await views(page))[1][2].page_referrer, base + "/");
    await page.goBack(); await waitViews(page, 3);
    await page.goForward(); await waitViews(page, 4);
    assert.equal(await page.evaluate(() => window.__QA_DOCUMENT__), id);
    assert.equal(requests.filter(x => x.host === "www.googletagmanager.com").length, 1);
    await page.reload(); await waitViews(page, 1);
    results.push({scenario:"initial view, SPA, back, forward, reload",passed:true}); await closeSession(context);
  }
  {
    const {context, page} = await session(accepted);
    await page.goto(base); await waitViews(page, 1);
    await navigate(page, "/resources/blog"); await waitViews(page, 2);
    assert.match((await views(page))[1][2].page_title, /Digerati Journal/);
    await navigate(page, "/trust/accessibility"); await waitViews(page, 3);
    assert.equal((await views(page))[2][2].page_title, await page.title());
    results.push({scenario:"Helmet and useSEO pages have final titles",passed:true}); await closeSession(context);
  }
  {
    const {context, page} = await session(accepted);
    let release;
    const gate = new Promise(resolve => {release = resolve;});
    await page.route("**/assets/Contact-*.js", async route => { await gate; await route.continue(); });
    await page.goto(base); await waitViews(page, 1);
    await navigate(page, "/contact"); await page.locator("[data-page-loading]").waitFor();
    assert.equal((await views(page)).length, 1);
    release(); await waitViews(page, 2);
    assert.match((await views(page))[1][2].page_title, /Contact/);
    results.push({scenario:"delayed lazy route waits for metadata",passed:true}); await closeSession(context);
  }
  for (const path of ["/portal/login", "/portal/tickets", "/login", "/internal/warehouse", "/official-network-planner"]) {
    const {context, page, requests} = await session({analytics:true,marketing:true});
    await page.goto(base + path); await page.locator("#app-canvas").waitFor({state:"attached"});
    assert.equal(requests.filter(x => vendor.test(x.host)).length, 0);
    assert.equal((await views(page)).length, 0);
    results.push({scenario:`private direct load ${path}`,passed:true}); await closeSession(context);
  }
  {
    const {context, page, requests} = await session({analytics:true,marketing:true});
    await page.goto(base); await waitViews(page, 1);
    const id = await page.evaluate(() => window.__QA_DOCUMENT__);
    const before = requests.length;
    await Promise.all([
      page.waitForEvent("framenavigated", {predicate: frame => frame === page.mainFrame()}),
      navigate(page, "/portal/login"),
    ]);
    await page.waitForLoadState("domcontentloaded"); await page.locator("#app-canvas").waitFor({state:"attached"});
    assert.notEqual(await page.evaluate(() => window.__QA_DOCUMENT__), id);
    assert.equal(requests.length, before); assert.equal((await views(page)).length, 0);
    // Leaving a portal document also reloads, then public measurement resumes.
    await Promise.all([page.waitForEvent("framenavigated", {predicate: frame => frame === page.mainFrame()}), navigate(page, "/")]);
    await waitViews(page, 1);
    results.push({scenario:"public to portal and portal to public isolate documents",passed:true}); await closeSession(context);
  }
  {
    const {context, page, requests} = await session({analytics:true,marketing:true});
    await page.goto("http://portal.example.test/portal/login"); await page.locator("#app-canvas").waitFor({state:"attached"});
    assert.equal(requests.length, 0); assert.equal((await views(page)).length, 0);
    results.push({scenario:"portal hostname excludes SDKs",passed:true}); await closeSession(context);
  }
  {
    const {context, page, requests} = await session({analytics:false,marketing:true});
    await page.goto(base); await page.locator("#home-main").waitFor();
    assert.equal((await views(page)).length, 0);
    assert.equal(requests.filter(x => x.host === "www.googletagmanager.com").length, 0);
    results.push({scenario:"marketing-only consent excludes Google SDK",passed:true}); await closeSession(context);
  }
  {
    const {context, page} = await session(accepted);
    await page.goto(base + "/not-a-real-ga4-qa-route"); await waitViews(page, 1);
    assert.match((await views(page))[0][2].page_title, /^404 - Page Not Found/);
    assert.equal((await views(page))[0][2].page_path, "/not-a-real-ga4-qa-route");
    for (const width of [390,768,1440]) {
      await page.setViewportSize({width,height:900}); await page.goto(base); await page.locator("#home-main").waitFor();
      await page.screenshot({path:`${out}/home-${width}.png`});
    }
    results.push({scenario:"404 attribution and public render at three widths",passed:true}); await closeSession(context);
  }
} catch (error) {
  const pages = [];
  for (const context of browser.contexts()) for (const page of context.pages()) {
    pages.push({url:page.url(),title:await page.title().catch(()=>"unknown"),views:await views(page).catch(()=>[])});
    await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});
  }
  results.push({passed:false,error:String(error),pages});
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({vendorSdkExecuted:false,googleReceiptVerified:false,results},null,2));
  console.log(JSON.stringify(results,null,2)); await browser.close(); preview?.kill();
}
