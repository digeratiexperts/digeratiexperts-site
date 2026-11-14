import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const asapSource = readFileSync(path.resolve(__dirname, "../components/ZohoASAPWidget.tsx"), "utf8");

describe("marketing shell before cookie consent", () => {
  it("does not load Google Fonts, analytics, advertising pixels, or Zoho marketing widgets from index.html", () => {
    expect(indexHtml).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(indexHtml).not.toMatch(/salesiq|pagesense|zohoforms|forms\.zoho/i);
    expect(indexHtml).not.toMatch(/googletagmanager|google-analytics|gtag\/js|clarity\.ms|connect\.facebook|linkedin\.com\/px/i);
    expect(indexHtml).toContain("/fonts/space-grotesk-latin.woff2");
  });

  it("loads the Zoho Desk ASAP script only when account and portal ids are provided", () => {
    expect(asapSource).toContain("static.zohocdn.com/desk/web-client/asap/v1/api.js");
    expect(asapSource).toMatch(/if\s*\(\s*!isEnabled\s*\|\|\s*!accountId\s*\|\|\s*!portalId\s*\)\s*return/);
  });
});
