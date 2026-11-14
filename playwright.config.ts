import { defineConfig } from "playwright/test";

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT || "4173", 10);
if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error("PLAYWRIGHT_PORT must be between 1024 and 65535");
}

const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*release-smoke.spec.ts",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 12_000,
  },
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : [["list"]],
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: "tablet-chromium",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-chromium",
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "npm run start:e2e",
    url: `${baseURL}/healthz`,
    env: {
      PLAYWRIGHT_PORT: String(port),
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
