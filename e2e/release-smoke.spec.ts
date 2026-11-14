import { expect, test, type Page } from "playwright/test";

import { RELEASE_SMOKE_ACCOUNT } from "./support/demoAccount";

type RuntimeMonitor = {
  assertHealthy: (route: string) => void;
};

function monitorRuntime(page: Page): RuntimeMonitor {
  const failures: string[] = [];

  page.on("pageerror", (error) => {
    failures.push(`uncaught page error: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (
      /(?:Uncaught|ReferenceError|TypeError|SyntaxError|failed to fetch dynamically imported module|React has detected)/i.test(
        text,
      )
    ) {
      failures.push(`console error: ${text}`);
    }
  });

  return {
    assertHealthy(route) {
      expect(failures, `Runtime errors while rendering ${route}`).toEqual([]);
      failures.length = 0;
    },
  };
}

async function expectResponsiveDocument(page: Page, route: string) {
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyTextLength: document.body.innerText.trim().length,
  }));

  expect(dimensions.bodyTextLength, `${route} rendered an empty shell`).toBeGreaterThan(100);
  expect(
    dimensions.documentWidth,
    `${route} has horizontal overflow at ${dimensions.viewportWidth}px`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
}

test.describe("public release surfaces", () => {
  test("Home, Pricing, and Store render responsively", async ({ page }) => {
    const runtime = monitorRuntime(page);
    const healthResponse = await page.request.get("/api/health");
    expect(healthResponse.ok()).toBeTruthy();
    const health = await healthResponse.json();
    expect(health).toMatchObject({
      env: "development",
      services: {
        database: "unavailable",
        zohoPayments: "not_configured",
        openai: "not_configured",
      },
    });

    const routes = [
      {
        path: "/",
        heading: /Your Arizona business,\s*protected 24\/7/i,
        primaryTestId: "button-hero-schedule",
      },
      {
        path: "/pricing",
        heading: /ProActive Ecosystem Pricing/i,
        primaryTestId: "selected-package-estimate",
      },
      {
        path: "/store",
        heading: /Tell us what you're trying to accomplish/i,
        primaryTestId: "button-build-solution",
      },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(new URL(page.url()).pathname).toBe(route.path);
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expect(page.getByTestId(route.primaryTestId)).toBeVisible();
      await expectResponsiveDocument(page, route.path);
      runtime.assertHealthy(route.path);
    }
  });
});

test.describe("portal release flow", () => {
  test("demo login reaches honest portal content and an expandable KB guide", async ({ page }) => {
    const runtime = monitorRuntime(page);

    await page.goto("/portal/login", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe("/portal/login");
    await expect(page.getByText("Client Portal", { exact: true })).toBeVisible();
    await page.getByTestId("input-email").fill(RELEASE_SMOKE_ACCOUNT.email);
    await page.getByTestId("input-password").fill(RELEASE_SMOKE_ACCOUNT.password);

    await Promise.all([
      page.waitForURL((url) => url.pathname === "/portal/dashboard"),
      page.getByTestId("button-login").click(),
    ]);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("button-new-ticket")).toBeVisible();
    await expect(page.getByTestId("button-view-kb")).toBeVisible();
    await expectResponsiveDocument(page, "/portal/dashboard");
    runtime.assertHealthy("/portal/login -> /portal/dashboard");

    await page.goto("/portal/status", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "System Status" })).toBeVisible();
    await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
    await expect(page.getByText(/Live tenant monitoring is not connected/i)).toBeVisible();
    await expect(page.getByTestId("link-open-support-request")).toHaveAttribute(
      "href",
      "/portal/tickets/create",
    );
    await expectResponsiveDocument(page, "/portal/status");
    runtime.assertHealthy("/portal/status");

    await page.goto("/portal/kb", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Knowledge Base" })).toBeVisible();
    const firstGuide = page.locator('[data-testid^="button-article-"]').first();
    await expect(firstGuide).toBeVisible();
    await expect(firstGuide).toHaveAttribute("aria-expanded", "false");
    await firstGuide.click();
    await expect(firstGuide).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/Need help applying this guidance/i)).toBeVisible();
    await expectResponsiveDocument(page, "/portal/kb");
    runtime.assertHealthy("/portal/kb article expansion");
  });
});
