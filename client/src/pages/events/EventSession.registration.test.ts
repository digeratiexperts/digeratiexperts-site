import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

vi.setConfig({ testTimeout: 15_000 });

// Exercise the actual page and native form validation. Every API and external
// request is intercepted; these synthetic receipts never reach CRM or email.
describe("Live Briefings contact receipt", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let base: string;
  let requests: Record<string, unknown>[];
  let contact: (route: Route) => Promise<void>;
  const receipt = { success: true, contactId: "0123456789abcdef0123456789abcdef", zohoLeadId: "1234567890123456789" };
  const values = { name: "Synthetic Visitor", email: "visitor@example.invalid", phone: "5550100123", company: "Synthetic Company" };

  beforeAll(async () => {
    server = await createServer({
      configFile: resolve(process.cwd(), "vite.config.ts"),
      server: { host: "127.0.0.1", port: 0 },
    });
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === "string") throw new Error("Missing local test server address");
    base = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({
      ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}),
      args: ["--no-sandbox"],
    });
  }, 90_000);

  beforeEach(async () => {
    requests = [];
    contact = async route => { await route.fulfill({ json: receipt }); };
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === "/api/contact") {
        requests.push(route.request().postDataJSON());
        return contact(route);
      }
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
      return route.continue();
    });
    page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-01T01:00:00Z"));
    await page.goto(`${base}/events/cyber-insurance-renewal-readiness`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("event-register-submit").waitFor({ timeout: 90_000 });
    for (const [name, value] of Object.entries(values)) await page.locator(`[name="${name}"]`).fill(value);
  }, 120_000);

  afterEach(async () => { await context?.close(); });
  afterAll(async () => { await browser?.close(); await server?.close(); });

  async function submit() { await page.getByTestId("event-register-submit").click(); }
  async function retained() {
    for (const [name, value] of Object.entries(values)) expect(await page.locator(`[name="${name}"]`).inputValue()).toBe(value);
  }
  async function unconfirmed() {
    await page.locator('form[aria-labelledby="register-heading"]').getByRole("alert").waitFor();
    expect(await page.locator('form[aria-labelledby="register-heading"]').getByRole("alert").innerText()).toContain("could not confirm");
    expect(await page.locator('form[aria-labelledby="register-heading"]').getByRole("alert").innerText()).not.toMatch(/private-error|1234567890123456789|visitor@example|stack/i);
    expect(await page.getByRole("heading", { name: "Interest received", exact: true }).count()).toBe(0);
    await retained();
    expect(requests).toHaveLength(1);
  }

  it("describes interest, without offering a seat or promising mail", async () => {
    const text = await page.locator('form[aria-labelledby="register-heading"]').innerText();
    expect(text).toContain("Register your interest");
    expect(text).not.toMatch(/save your seat|one email|one reminder/i);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Add to calendar", exact: true }).click();
    const file = await (await download).path();
    const { readFile } = await import("node:fs/promises");
    expect(await readFile(file!, "utf8")).not.toMatch(/join link is emailed/i);
  });

  it("acknowledges only a valid contact receipt", async () => {
    await submit();
    await page.getByRole("heading", { name: "Interest received", exact: true }).waitFor();
    const text = await page.getByRole("status").filter({ hasText: "Interest received" }).innerText();
    expect(text).toContain("received your interest");
    expect(text).toContain("does not confirm webinar enrollment or email delivery");
    expect(text).not.toMatch(/on the list|we'll email|reserved|1234567890123456789|visitor@example/i);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ ...values, website_url: "", service: "Event registration: cyber-insurance-renewal-readiness" });
    expect(requests[0].message).toContain("Registered interest in");
  });

  it.each([
    ["null lead", { ...receipt, zohoLeadId: null }],
    ["missing lead", { success: true, contactId: receipt.contactId }],
    ["empty lead", { ...receipt, zohoLeadId: " " }],
    ["numeric lead", { ...receipt, zohoLeadId: 123 }],
    ["missing contact", { success: true, zohoLeadId: receipt.zohoLeadId }],
    ["empty body", {}],
    ["null body", null],
    ["array body", [receipt]],
    ["string body", "success"],
    ["nonboolean success", { ...receipt, success: "true" }],
    ["explicit failure", { ...receipt, success: false, error: "private-error stack visitor@example.invalid" }],
  ])("keeps %s unconfirmed and preserves fields", async (_name, body) => {
    contact = async route => { await route.fulfill({ body: JSON.stringify(body), contentType: "application/json" }); };
    await submit();
    await unconfirmed();
  });

  it("keeps malformed2xx unconfirmed", async () => {
    contact = async route => { await route.fulfill({ body: "not json private-error", contentType: "text/plain" }); };
    await submit(); await unconfirmed();
  });

  it("keeps an empty204 unconfirmed", async () => {
    contact = async route => { await route.fulfill({ status: 204 }); };
    await submit(); await unconfirmed();
  });

  it("does not expose server errors or accept a receipt on HTTP failure", async () => {
    contact = async route => { await route.fulfill({ status: 500, json: { ...receipt, error: "private-error stack" } }); };
    await submit(); await unconfirmed();
  });

  it("does not retry an uncertain network write", async () => {
    contact = async route => { await route.abort("failed"); };
    await submit(); await unconfirmed();
    expect(await page.locator('form[aria-labelledby="register-heading"]').getByRole("alert").innerText()).toMatch(/before submitting again/i);
    await page.waitForTimeout(250);
    expect(requests).toHaveLength(1);
  });

  it("blocks rapid repeated submits and announces pending state", async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    contact = async route => { await pending; await route.fulfill({ json: receipt }); };
    await page.locator('form[aria-labelledby="register-heading"]').evaluate(form => {
      for (let i = 0; i < 3; i++) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await page.getByText("Sending…", { exact: true }).waitFor();
    expect(await page.getByTestId("event-register-submit").isDisabled()).toBe(true);
    expect(await page.locator('form[aria-labelledby="register-heading"]').getAttribute("aria-busy")).toBe("true");
    await page.waitForTimeout(150);
    const count = requests.length;
    release();
    expect(count).toBe(1);
    await page.getByRole("heading", { name: "Interest received", exact: true }).waitFor();
  });

  it("preserves native validation, labels, honeypot and keyboard submission", async () => {
    await page.getByLabel("Work email").fill("invalid");
    await submit(); expect(requests).toHaveLength(0);
    await page.getByLabel("Work email").fill(values.email);
    const trap = page.locator('[name="website_url"]');
    expect(await trap.getAttribute("tabindex")).toBe("-1");
    expect(await trap.getAttribute("aria-hidden")).toBe("true");
    expect(await trap.isVisible()).toBe(false);
    await page.getByLabel("Company", { exact: true }).focus();
    await page.keyboard.press("Tab");
    expect(await page.getByTestId("event-register-submit").evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Interest received", exact: true }).waitFor();
    expect(requests).toHaveLength(1);
  });

  it.each(["received", "pending"])("does not carry a %s receipt into a different session", async state => {
    let release!: () => void;
    if (state === "pending") {
      const pending = new Promise<void>(resolve => { release = resolve; });
      contact = async route => { await pending; await route.fulfill({ json: receipt }); };
    }
    await submit();
    if (state === "received") await page.getByRole("heading", { name: "Interest received", exact: true }).waitFor();
    else await page.getByText("Sending…", { exact: true }).waitFor();
    await page.evaluate(() => {
      history.pushState(null, "", "/events/holiday-invoice-fraud-and-phishing");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.getByRole("heading", { name: "Holiday Invoice Fraud: How Payment-Change Emails Get Past Busy Teams", exact: true }).waitFor();
    if (state === "pending") release();
    await page.getByTestId("event-register-submit").waitFor();
    expect(await page.getByTestId("event-register-submit").isEnabled()).toBe(true);
    await page.waitForTimeout(100);
    expect(await page.getByRole("heading", { name: "Interest received", exact: true }).count()).toBe(0);
    expect(requests).toHaveLength(1);
  });

  it.each([390, 768, 1440])("keeps the form operable at %ipx", async width => {
    await page.setViewportSize({ width, height: 1000 });
    const form = page.locator('form[aria-labelledby="register-heading"]');
    await form.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const label of ["Name", "Work email", "Phone", "Company"]) {
      expect(await form.getByLabel(label, { exact: label === "Company" }).isVisible()).toBe(true);
    }
    await page.getByLabel("Company", { exact: true }).focus();
    await page.keyboard.press("Tab");
    expect(await page.getByTestId("event-register-submit").evaluate(el => el === document.activeElement)).toBe(true);
    const box = await page.getByTestId("event-register-submit").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Interest received", exact: true }).waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
