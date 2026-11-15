import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildLearningPayload } from "../../../../server/portalLearningCatalog";
import { naiveLearningResourceTitle } from "@shared/learningResourceTitle";

vi.setConfig({ testTimeout: 180_000 });

const USER = {
  id: "example-admin",
  role: "admin",
  fullName: "EXAMPLE Admin",
  email: "admin@example.invalid",
};
const LONG_AGENT =
  "Mozilla/5.0 (EXAMPLE; Synthetic Device) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ExampleAudit/1.0";

function learningBody() {
  const payload = buildLearningPayload("de_admin");
  const slugs = ["sow-bdr", "sow-vcio-strategic", "proactive-it-tier-bridge", "onboarding-checklist"];
  return {
    ...payload,
    recommendedMinutes: 12,
    catalogVersion: "example-fixture",
    lessonCountTotal: payload.lessons.length,
    hub: {
      source: "none",
      resources: slugs.map((slug) => ({
        slug,
        title: naiveLearningResourceTitle(slug),
        category: "service_tier",
        description: "EXAMPLE disconnected catalog reference",
      })),
    },
  };
}

describe("portal audit closeout #544 findings 04, 10, 13, 14", () => {
  let server: ViteDevServer;
  let fixture: string;
  let browser: Browser;
  let base: string;

  beforeAll(async () => {
    const root = process.cwd();
    fixture = await mkdtemp(join(root, ".qa-c15-portal-"));
    await writeFile(
      join(fixture, "index.html"),
      '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>EXAMPLE portal audit fixture</title></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
    );
    await writeFile(
      join(fixture, "fixture.tsx"),
      `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import PortalChat from "@/pages/portal/PortalChat";
      import { AdminLoginKnocks } from "@/pages/portal/AdminLoginKnocks";
      import PortalLearning from "@/pages/portal/PortalLearning";
      import "@/index.css";
      const screen = new URLSearchParams(location.search).get("screen");
      const Page = screen === "knocks" ? AdminLoginKnocks : screen === "learning" ? PortalLearning : PortalChat;
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
      createRoot(document.getElementById("root")!).render(
        <QueryClientProvider client={client}><Page /></QueryClientProvider>
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

  async function open(page: Page, screen: string) {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/index.html?screen=${screen}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(overflow, `${screen} horizontal overflow`).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  }

  it("keeps chat labels on one line and empty panes compact at 390, 768 and 1440", async () => {
    for (const width of [390, 768, 1440]) {
      for (const theme of ["light", "dark"] as const) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          reducedMotion: "reduce",
        });
        await context.addInitScript(({ theme, user }) => {
          localStorage.setItem("de-portal-theme", theme);
          localStorage.setItem("portalUser", JSON.stringify(user));
          localStorage.setItem("de-portal-tour-done", "true");
        }, { theme, user: USER });
        let chatBlocked = false;
        await context.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== base) return route.abort();
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (route.request().method() !== "GET") {
            return route.fulfill({ status: 405, contentType: "application/json", body: '{"message":"EXAMPLE fixture does not write"}' });
          }
          let body: unknown = {};
          if (url.pathname === "/api/portal/me") body = { user: USER };
          else if (url.pathname === "/api/portal/chat/status") {
            body = chatBlocked
              ? { allowed: false, message: "EXAMPLE Live chat is limited to IT contacts." }
              : { allowed: true };
          } else if (url.pathname === "/api/portal/chat/messages") body = { success: true, messages: [] };
          else if (url.pathname === "/api/portal/chat/sessions") body = { success: true, sessions: [] };
          else if (url.pathname === "/api/portal/desk-chats") body = { success: true, sessions: [] };
          else if (url.pathname === "/api/portal/integrations") body = { integrations: {} };
          else if (url.pathname === "/api/portal/learning") body = learningBody();
          else if (url.pathname === "/api/portal/admin/login-knocks") {
            body = {
              summary: { sinceHours: 24, total: 1, bots: 0, humans: 1, failed: 0, success: 0, pageHits: 1, uniqueIps: 1, topIps: [] },
              knocks: [{
                id: "example-knock-1",
                kind: "page_hit",
                email: "person@example.invalid",
                ip: "203.0.113.10",
                userAgent: LONG_AGENT,
                path: "/portal/login",
                isBotLikely: false,
                botReason: null,
                createdAt: "2026-11-09T15:00:00.000Z",
              }],
            };
          }
          await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);

        await open(page, "chat");
        for (const id of ["chat-channel-website", "chat-channel-portal"]) {
          const lines = await page.getByTestId(id).locator("[data-channel-label]").evaluate((el) => el.getClientRects().length);
          expect(lines, `${id} wraps at ${width}/${theme}`).toBe(1);
        }
        const emptyThread = await page.getByTestId("desk-empty-thread").boundingBox();
        expect(emptyThread, "empty desk thread").toBeTruthy();
        if (width < 1024) expect(emptyThread!.height).toBeLessThan(360);
        await page.getByTestId("chat-channel-portal").click();
        const live = await page.getByTestId("portal-live-chat").boundingBox();
        expect(live, "empty portal chat").toBeTruthy();
        expect(live!.height).toBeLessThan(360);

        chatBlocked = true;
        await page.goto(`${base}/index.html?screen=chat`);
        await page.getByTestId("chat-channel-portal").click();
        await page.getByTestId("chat-access-notice").waitFor();
        if (theme === "light" && (width === 390 || width === 1440) && existsSync("/opt/cursor")) {
          mkdirSync("/opt/cursor/artifacts", { recursive: true });
          await page.screenshot({ path: `/opt/cursor/artifacts/c15-chat-notice-${width}.png` });
        }
        const ratio = await page.getByTestId("chat-access-notice").evaluate((el) => {
          const parse = (value: string) => {
            const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (!match) return { r: 0, g: 0, b: 0, a: 1 };
            return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) };
          };
          const lin = (channel: number) => {
            const s = channel / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          const lum = (rgb: { r: number; g: number; b: number }) => 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
          const blend = (fg: { r: number; g: number; b: number; a: number }, bg: { r: number; g: number; b: number }) => ({
            r: fg.r * fg.a + bg.r * (1 - fg.a),
            g: fg.g * fg.a + bg.g * (1 - fg.a),
            b: fg.b * fg.a + bg.b * (1 - fg.a),
          });
          let node: HTMLElement | null = el;
          let background = parse(getComputedStyle(el).backgroundColor);
          const pageBg = parse(getComputedStyle(document.body).backgroundColor);
          while (node && background.a < 1) {
            const parent = node.parentElement;
            const under = parent ? parse(getComputedStyle(parent).backgroundColor) : pageBg;
            background = { ...blend(background, under), a: 1 };
            node = parent;
          }
          const text = parse(getComputedStyle(el).color);
          const fg = text.a < 1 ? blend(text, background) : text;
          const lighter = Math.max(lum(fg), lum(background));
          const darker = Math.min(lum(fg), lum(background));
          return (lighter + 0.05) / (darker + 0.05);
        });
        expect(ratio, `access notice contrast at ${width}/${theme}`).toBeGreaterThanOrEqual(4.5);

        await open(page, "knocks");
        const show = page.getByRole("button", { name: "Show browser details" });
        await show.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("button", { name: "Hide browser details" }).waitFor();
        const agent = page.locator("[data-testid='knock-user-agent']:visible");
        expect(await agent.innerText()).toContain("ExampleAudit/1.0");
        const expanded = await agent.evaluate((el) => !el.className.includes("truncate"));
        expect(expanded, `browser details stay clipped at ${width}/${theme}`).toBe(true);

        await open(page, "learning");
        await page.getByText("SOW BDR", { exact: true }).waitFor();
        await page.getByText("SOW vCIO Strategic", { exact: true }).waitFor();
        await page.getByText("ProActive IT Tier Bridge", { exact: true }).waitFor();
        expect(await page.getByText("Sow Bdr", { exact: true }).count()).toBe(0);
        expect(await page.getByText("Sow Vcio Strategic", { exact: true }).count()).toBe(0);
        if (theme === "light" && (width === 390 || width === 1440) && existsSync("/opt/cursor/artifacts")) {
          const title = page.getByText("SOW BDR", { exact: true });
          await title.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `/opt/cursor/artifacts/c15-learning-${width}.png` });
          await page.goto(`${base}/index.html?screen=knocks`);
          const show = page.getByRole("button", { name: "Show browser details" });
          await show.scrollIntoViewIfNeeded();
          await show.click();
          await page.screenshot({ path: `/opt/cursor/artifacts/c15-knocks-${width}.png` });
        }

        await context.close();
      }
    }
  });
});
