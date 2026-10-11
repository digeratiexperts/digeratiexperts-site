// Renders the real production build with EXAMPLE API fixtures; no live API calls.
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
const repo = path.resolve(import.meta.dirname, "../..");
const output = path.join(repo, "artifacts/visual-qa/portal-black-theme");
await mkdir(output, { recursive: true });
const user = { id: "example-user", fullName: "Alex Example", email: "alex@example.com", role: "client", orgRole: "company_it_contact", isCompanyItContact: true, clientId: "example-client", client: { companyName: "Example Company" } };
const fixtures = {
  "/api/portal/me": { user },
  "/api/portal/profile": { ...user, manager: null, companyDomains: ["example.com"] },
  "/api/portal/integrations": { integrations: { vpn: { mode: "hidden", provider: null }, phone: { mode: "hidden", provider: null }, shipping: { mode: "hidden", provider: null } } },
  "/api/portal/profile/provisioning": { overall: "not_started", steps: [{ key: "identity", state: "not_started", label: "Example identity account", detail: "Example fixture: account setup has not started." }], orders: [], lastRunAt: null, lastAction: null, checkedAt: "2026-10-11T12:00:00Z" },
  "/api/portal/mfa/status": { mfaEnabled: false, passkeys: [] },
  "/api/portal/auth/zoho/status": { configured: false }
};
const browser = await chromium.launch({ executablePath: process.env.PORTAL_QA_CHROMIUM_PATH || void 0, headless: true });
const errors = [];
const observations = [];
const accessibility = [];
const apiRequests = /* @__PURE__ */ new Set();
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };
async function contextFor(width, prefs = {}, authenticated = true) {
  const context = await browser.newContext({ viewport: { width, height: 1e3 }, colorScheme: "dark", reducedMotion: "reduce" });
  await context.addInitScript(({ user: user2, prefs: prefs2, authenticated: authenticated2 }) => {
    if (location.hostname !== "portal-qa.local") return;
    if (authenticated2) {
      localStorage.setItem("portalToken", "EXAMPLE-browser-fixture");
      localStorage.setItem("portalUser", JSON.stringify(user2));
    }
    for (const [key, value] of Object.entries(prefs2)) localStorage.setItem(key, value);
  }, { user, prefs, authenticated });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "portal-qa.local") return route.abort();
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith("/api/")) {
      apiRequests.add(pathname);
      if (!authenticated && pathname === "/api/portal/me") return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      if (pathname === "/api/portal/events/stream") return route.fulfill({ contentType: "text/event-stream", body: "event: stream.ready\ndata: {}\n\n" });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(fixtures[pathname] ?? {}) });
    }
    const target = path.join(repo, "dist/public", pathname.startsWith("/portal/") || pathname === "/about/mission" ? "index.html" : pathname);
    try {
      return route.fulfill({ body: await readFile(target), contentType: types[path.extname(target)] ?? "application/octet-stream" });
    } catch {
      return route.fulfill({ status: 404, body: "Fixture asset unavailable" });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(1e4);
  return { context, page };
}
async function go(page, url = "/portal/settings") {
  await page.goto("http://portal-qa.local" + url, { waitUntil: "domcontentloaded" });
  if (url === "/portal/settings") await page.locator("#settings-appearance").waitFor();
  else await page.locator(".de-portal").waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function choose(page, type, value) {
  const radio = page.getByTestId(`settings-${type}-${value}`);
  await radio.locator("..").click();
  await page.waitForFunction(({ type: type2, value: value2 }) => document.documentElement.dataset[type2] === value2, { type, value });
  assert(await radio.isChecked());
}
const rgbColors = { black: "rgb(0, 0, 0)", dark: "rgb(5, 5, 14)", light: "rgb(245, 245, 249)" };
const surfaces = { black: "rgb(8, 8, 11)", dark: "rgb(13, 13, 26)", light: "rgb(255, 255, 255)" };
function ratio(a, b) {
  const lum = (s) => {
    let c = s.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  let x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
try {
  for (const width of [390, 768, 1440]) {
    const { context: context2, page: page2 } = await contextFor(width);
    await go(page2);
    assert.equal(await page2.locator("html").getAttribute("data-theme"), "black");
    for (const theme of ["black", "dark", "light"]) {
      await choose(page2, "theme", theme);
      for (const contrast of ["none", "boost", "max"]) {
        await choose(page2, "contrast", contrast);
        await page2.mouse.move(0, 0);
        const colors = await page2.evaluate(() => {
          const css = (e) => {
            const s = getComputedStyle(e);
            return { background: s.backgroundColor, color: s.color, border: s.borderColor };
          };
          return { root: css(document.documentElement), body: css(document.body), canvas: css(document.querySelector(".pt-canvas")), panel: css(document.querySelector("#settings-appearance")), button: css(document.querySelector('[data-testid="button-save-profile"]')), input: css(document.querySelector('[data-testid="input-fullname"]')), overflow: document.documentElement.scrollWidth > innerWidth, contrast: document.documentElement.dataset.contrast };
        });
        assert.equal(colors.body.background, rgbColors[theme]);
        assert.equal(colors.canvas.background, rgbColors[theme]);
        assert.equal(colors.panel.background, surfaces[theme]);
        assert.equal(colors.overflow, false);
        assert(ratio(colors.button.color, colors.button.background) >= 4.5, `Button contrast ${theme}/${contrast}`);
        observations.push({ width, theme, contrast, colors });
        if (width === 1440) {
          const audit = await new AxeBuilder({ page: page2 }).include("#settings-appearance").include("#settings-profile").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
          accessibility.push({ theme, contrast, violations: audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })) });
          assert.deepEqual(audit.violations, [], `Appearance/profile accessibility ${theme}/${contrast}`);
        }
        if (contrast === "none" || width === 1440 && contrast === "max") await page2.screenshot({ path: path.join(output, `${theme}-${contrast}-settings-${width}.png`), fullPage: false });
      }
    }
    await choose(page2, "theme", "black");
    await choose(page2, "contrast", "none");
    const appearanceBefore = await page2.getByTestId("settings-theme-black").isChecked();
    assert(appearanceBefore);
    await page2.reload({ waitUntil: "domcontentloaded" });
    await page2.locator("#settings-appearance").waitFor();
    assert.equal(await page2.locator("html").getAttribute("data-theme"), "black");
    if (width === 390) {
      await page2.getByRole("button", { name: "Toggle navigation", exact: true }).click();
      await page2.getByRole("dialog").waitFor();
      await page2.screenshot({ path: path.join(output, "black-mobile-navigation-390.png") });
      await page2.keyboard.press("Escape");
    }
    await context2.close();
  }
  const { context, page } = await contextFor(1440);
  await go(page);
  await page.getByTestId("button-user-menu").click();
  assert.equal(await page.getByTestId("menu-theme-black").getAttribute("aria-checked"), "true");
  await page.screenshot({ path: path.join(output, "black-account-menu-1440.png") });
  await page.getByTestId("menu-theme-light").click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  assert(await page.getByTestId("settings-theme-light").isChecked());
  await choose(page, "contrast", "max");
  await page.getByTestId("button-user-menu").click();
  await page.screenshot({ path: path.join(output, "light-max-account-menu-1440.png") });
  await page.keyboard.press("Escape");
  await page.getByTestId("button-command-palette").click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: path.join(output, "light-max-command-palette-1440.png") });
  await page.keyboard.press("Escape");
  await page.getByTestId("settings-theme-system").locator("..").click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  assert.equal(await page.evaluate(() => localStorage.getItem("de-portal-theme")), "system");
  await choose(page, "theme", "black");
  await choose(page, "contrast", "boost");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#settings-appearance").waitFor();
  assert.equal(await page.locator("html").getAttribute("data-contrast"), "boost");
  const peer = await context.newPage();
  await go(peer);
  await choose(page, "theme", "light");
  await choose(page, "contrast", "max");
  await peer.waitForFunction(() => document.documentElement.dataset.theme === "light" && document.documentElement.dataset.contrast === "max");
  await choose(page, "theme", "black");
  await choose(page, "contrast", "boost");
  await peer.waitForFunction(() => document.documentElement.dataset.theme === "black" && document.documentElement.dataset.contrast === "boost");
  await peer.evaluate(() => {
    history.pushState({}, "", "/about/mission");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await peer.waitForFunction(() => !document.documentElement.classList.contains("de-portal-root") && !document.body.classList.contains("de-portal-scope"));
  assert.equal(await peer.locator("html").getAttribute("data-theme"), null);
  assert.equal(await peer.locator("html").getAttribute("data-contrast"), null);
  await peer.close();
  await page.getByTestId("settings-contrast-max").focus();
  await page.screenshot({ path: path.join(output, "black-boost-focus-1440.png") });
  await context.close();
  for (const theme of ["black", "light"]) {
    const { context: context2, page: page2 } = await contextFor(390, { "de-portal-theme": theme, "de-portal-contrast": "none" }, false);
    await go(page2, "/portal/login");
    assert.equal(await page2.locator("html").getAttribute("data-theme"), theme);
    const audit = await new AxeBuilder({ page: page2 }).include(".de-portal").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    accessibility.push({ page: "login", theme, contrast: "none", violations: audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })) });
    assert.deepEqual(audit.violations, [], `Login accessibility ${theme}`);
    await page2.screenshot({ path: path.join(output, `${theme}-login-390.png`), fullPage: true });
    await context2.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "browser-results.json"), JSON.stringify({ classification: "EXAMPLE: rendered production build with mocked API data", observations, accessibility, errors, apiRequests: [...apiRequests], checks: ["27 theme/contrast/viewport combinations", "Exact canvas and card colors", "No horizontal overflow", "Primary button text contrast \u2265 4.5:1", "Menu/settings synchronization", "Persistence on reload", "Match device updates live", "Mobile navigation sheet", "Portalled account menu and command palette", "Auth page preferences", "Cross-tab preference synchronization", "Portal scope cleanup on public route"] }, null, 2));
  console.log("Portal browser checks passed:", observations.length, "combinations;", errors.length, "page errors");
  console.log("API fixtures requested:", [...apiRequests].join(", "));
} finally {
  await browser.close();
}
