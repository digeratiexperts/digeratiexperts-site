import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const asapSource = readFileSync(path.resolve(__dirname, "../components/ZohoASAPWidget.tsx"), "utf8");
const indexLower = indexHtml.toLowerCase();

describe("marketing shell before cookie consent", () => {
  it("does not load Google Fonts, analytics, advertising pixels, or Zoho marketing widgets from index.html", () => {
    expect(indexHtml).not.toContain("fonts.googleapis.com");
    expect(indexHtml).not.toContain("fonts.gstatic.com");
    expect(indexLower).not.toContain("salesiq");
    expect(indexLower).not.toContain("pagesense");
    expect(indexLower).not.toContain("zohoforms");
    expect(indexLower).not.toContain("forms.zoho");
    expect(indexHtml).not.toContain("googletagmanager");
    expect(indexHtml).not.toContain("google-analytics");
    expect(indexHtml).not.toContain("gtag/js");
    expect(indexHtml).not.toContain("clarity.ms");
    expect(indexHtml).not.toContain("connect.facebook");
    expect(indexHtml).not.toContain("linkedin.com/px");
    expect(indexHtml).toContain("/fonts/space-grotesk-latin.woff2");
  });

  it("loads the Zoho Desk ASAP script only when account and portal ids are provided", () => {
    expect(asapSource).toContain("static.zohocdn.com/desk/web-client/asap/v1/api.js");
    expect(asapSource.includes("if (!isEnabled || !accountId || !portalId) return")).toBe(true);
  });
});
