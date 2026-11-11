import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { applyPrerender, prerenderFor } from "./prerender";
import { prerenderRoutes, snapshotFileName } from "../scripts/prerender/routes.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "de-prerender-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

fs.writeFileSync(path.join(dir, "index.html"), "<main><h1>Home</h1></main>");
fs.writeFileSync(path.join(dir, "pricing.html"), "<main><h1>Pricing</h1></main>");
fs.writeFileSync(
  path.join(dir, "manifest.json"),
  JSON.stringify({
    routes: {
      "/": { file: "index.html", styles: ["/assets/HomepageV2-abc123.css", "https://evil.example/x.css"] },
      "/pricing": { file: "pricing.html" },
      "/escape": { file: "../../etc/passwd" },
    },
  }),
);

const SHELL = '<html><head><title>t</title></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>';

describe("prerender serving", () => {
  it("puts the snapshot next to a hidden app root", () => {
    const out = applyPrerender(SHELL, prerenderFor(dir, "/"));
    expect(out).toContain('<div id="de-prerender" data-prerendered="true"><main><h1>Home</h1></main></div><div id="root" hidden></div>');
    expect(out.match(/id="root"/g)).toHaveLength(1);
  });

  it("links only same-origin hashed stylesheets", () => {
    const out = applyPrerender(SHELL, prerenderFor(dir, "/"));
    expect(out).toContain('href="/assets/HomepageV2-abc123.css"');
    expect(out).not.toContain("evil.example");
  });

  it("normalizes the path like the SPA router", () => {
    expect(prerenderFor(dir, "/Pricing/")?.html).toContain("Pricing");
  });

  it("falls back to the plain shell when there is no snapshot", () => {
    expect(applyPrerender(SHELL, prerenderFor(dir, "/no-such-page"))).toBe(SHELL);
    expect(applyPrerender(SHELL, prerenderFor(path.join(dir, "missing"), "/"))).toBe(SHELL);
  });

  it("refuses manifest entries that point outside the snapshot folder", () => {
    expect(prerenderFor(dir, "/escape")).toBeUndefined();
  });
});

describe("prerender routes", () => {
  it("covers the homepage, pricing, a city page and an industry page, never the portal or store", () => {
    const routes: string[] = prerenderRoutes();
    expect(routes).toContain("/");
    expect(routes).toContain("/pricing");
    expect(routes.some((r) => r.startsWith("/locations/"))).toBe(true);
    expect(routes.some((r) => r.startsWith("/industries/"))).toBe(true);
    expect(routes.some((r) => r.startsWith("/portal") || r.startsWith("/store"))).toBe(false);
  });

  it("maps routes to flat, safe file names", () => {
    expect(snapshotFileName("/")).toBe("index.html");
    expect(snapshotFileName("/locations/phoenix-az")).toBe("locations__phoenix-az.html");
  });
});
