import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Joe, 2026-10-03: the portal's light mode is "Ambient" (option B): orchid instead of grey, lit by
// a magenta and a violet glow; cards stay white and the rail stays graphite.
const root = path.resolve(import.meta.dirname, "../../..");
const css = readFileSync(path.join(root, "client/src/styles/portal.css"), "utf8");
const layout = readFileSync(path.join(root, "client/src/pages/portal/PortalLayout.tsx"), "utf8");

function lightBlock(): string {
  const start = css.indexOf('.de-portal[data-theme="light"],\nbody.de-portal-scope[data-portal-theme="light"] {');
  expect(start, "light theme block").toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("portal light theme: Ambient", () => {
  it("paints the field and wells orchid, not grey, and keeps cards white", () => {
    const block = lightBlock();
    expect(block).toContain("--background: 290 42% 96%;");
    expect(block).toContain("--muted: 292 38% 92%;");
    expect(block).toContain("--accent: 300 36% 89%;");
    expect(block).toContain("--border: 290 20% 85%;");
    expect(block).toContain("--card: 0 0% 100%;");
    expect(block).not.toMatch(/--background: 36 24% 96%/);
  });

  it("lights the content area with the magenta and violet glow, in light mode only", () => {
    expect(css).toMatch(/\.de-portal\[data-theme="light"\] \.pt-canvas,[\s\S]*?radial-gradient\([^)]*rgb\(211 18 106/);
    expect(css).toMatch(/radial-gradient\([^)]*rgb\(91 69 224/);
    expect(layout).toContain('<SidebarInset className="pt-canvas min-w-0 bg-background">');
  });

  it("leaves the graphite rail's own colours in place", () => {
    expect(css).toContain('.de-portal[data-theme="light"] [data-sidebar="sidebar"],');
  });
});
