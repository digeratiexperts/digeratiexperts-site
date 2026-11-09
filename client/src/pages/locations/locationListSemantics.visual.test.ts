import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

vi.setConfig({ testTimeout: 180_000 });

describe("location pages list and form semantics (#544)", () => {
  let server: ViteDevServer;
  let fixture: string;
  let browser: Browser;
  let base: string;

  beforeAll(async () => {
    const root = process.cwd();
    fixture = await mkdtemp(join(root, ".qa-c15-location-"));
    await writeFile(
      join(fixture, "index.html"),
      '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>EXAMPLE location fixture</title></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
    );
    await writeFile(
      join(fixture, "fixture.tsx"),
      `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { BookingProvider } from "@/contexts/BookingContext";
      import { LocationServicePage } from "@/pages/locations/LocationServicePage";
      import { locationPageData } from "@/pages/routes/locationPages";
      import "@/index.css";
      createRoot(document.getElementById("root")!).render(
        <BookingProvider><LocationServicePage {...locationPageData["chandler-az"]} /></BookingProvider>
      );
    `,
    );
    server = await createServer({
      configFile: false,
      root: fixture,
      cacheDir: join(fixture, ".vite"),
      publicDir: resolve(root, "client/public"),
      esbuild: { jsx: "automatic" },
      optimizeDeps: { entries: ["index.html"] },
      resolve: {
        alias: {
          "@": resolve(root, "client/src"),
          "@shared": resolve(root, "shared"),
          "@assets": resolve(root, "attached_assets"),
          "@brand": resolve(root, "brand"),
        },
      },
      server: { host: "127.0.0.1", port: 0 },
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing local test server address");
    base = `http://127.0.0.1:${address.port}`;
    const executablePath = ["/usr/bin/chromium", "/usr/bin/google-chrome"].find((candidate) => existsSync(candidate));
    browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox"],
    });
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
    if (fixture) await rm(fixture, { recursive: true, force: true });
  });

  async function open(page: Page) {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const heading = page.getByRole("heading", { level: 1 }).first();
    const seen = await heading.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
    if (!seen) {
      throw new Error(`no h1\n${errors.join("\n")}\n${(await page.locator("body").innerText()).slice(0, 1200)}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(overflow, "horizontal overflow").toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  }

  it("uses real lists and keeps the assessment action inside the card at 390, 768 and 1440", async () => {
    for (const width of [390, 768, 1440]) {
      for (const theme of ["light", "dark"] as const) {
        const writes: string[] = [];
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await context.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== base) return route.abort();
          if (url.pathname.startsWith("/api/")) {
            if (route.request().method() !== "GET") writes.push(url.pathname);
            return route.fulfill({ contentType: "application/json", body: "{}" });
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        await open(page);

        const cities = page.getByRole("navigation", { name: "Greater Phoenix cities" });
        expect(await cities.getByRole("listitem").count()).toBe(6);
        expect(await cities.getByRole("link", { name: "Chandler", exact: true }).getAttribute("aria-current")).toBe("page");
        expect(await cities.getByRole("link", { name: "Scottsdale", exact: true }).getAttribute("href")).toBe("/locations/scottsdale-az");

        const points = page.getByRole("list", { name: "What this request includes" });
        expect(await points.getByRole("listitem").count()).toBe(3);
        await expectText(points, "On-site Chandler support");

        const proof = page.locator("dl > div").first();
        const tags = await proof.evaluate((el) => [...el.querySelectorAll(":scope > div > *")].map((node) => node.tagName));
        expect(tags.slice(0, 2)).toEqual(["DT", "DD"]);

        const submit = page.getByTestId("button-chandler-submit");
        await submit.scrollIntoViewIfNeeded();
        const clipped = await submit.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          return text.width === 0 || text.right > box.right + 1 || text.left < box.left - 1 || el.scrollWidth > el.clientWidth + 1;
        });
        expect(clipped, `assessment action clipped at ${width}/${theme}`).toBe(false);
        expect(await submit.innerText()).toContain("Get My Cyber Risk Assessment");

        await page.getByLabel("Full Name").fill("A");
        await submit.click();
        await page.getByText("Name must be at least 2 characters", { exact: true }).waitFor();
        expect(writes, "invalid form must not post").toEqual([]);

        if (theme === "light" && (width === 390 || width === 1440) && existsSync("/opt/cursor")) {
          mkdirSync("/opt/cursor/artifacts", { recursive: true });
          await page.screenshot({ path: `/opt/cursor/artifacts/c15-location-form-${width}.png` });
          await cities.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `/opt/cursor/artifacts/c15-location-cities-${width}.png` });
        }
        await context.close();
      }
    }
  });
});

async function expectText(root: ReturnType<Page["getByRole"]>, text: string) {
  expect(await root.getByText(text, { exact: true }).count()).toBeGreaterThan(0);
}
