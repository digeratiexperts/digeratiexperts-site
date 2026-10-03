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

  it("keeps every state ink at 4.5:1 or better on its own tint over the orchid surfaces", () => {
    // Tags, callouts and verdict bands tint 7-10% of their tone over the field, a well or a card
    // (avatars use 12% of brand). Found on /portal/sales-process: ok ink fell to 4.42:1 on orchid.
    const block = lightBlock();
    const hsl = (name: string) => {
      const m = block.match(new RegExp(`--${name}: (\\d+) (\\d+)% (\\d+)%;`));
      expect(m, name).not.toBeNull();
      return hslToRgb(Number(m![1]), Number(m![2]), Number(m![3]));
    };
    const rgb = (name: string) => {
      const m = block.match(new RegExp(`--pt-${name}: (\\d+) (\\d+) (\\d+);`));
      expect(m, name).not.toBeNull();
      return [Number(m![1]), Number(m![2]), Number(m![3])] as const;
    };
    const surfaces = { field: hsl("background"), well: hsl("muted"), card: hsl("card") };
    for (const tone of ["ok", "warn", "bad", "info", "brand"]) {
      const ink = rgb(tone);
      const alphas = tone === "brand" ? [0.07, 0.08, 0.1, 0.12] : [0.07, 0.08, 0.1];
      for (const [surface, ground] of Object.entries(surfaces)) {
        for (const alpha of alphas) {
          const tint = ground.map((c, i) => ink[i] * alpha + c * (1 - alpha));
          expect(contrast(ink, tint), `${tone} on ${surface} @${alpha}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("leaves the graphite rail's own colours in place", () => {
    expect(css).toContain('.de-portal[data-theme="light"] [data-sidebar="sidebar"],');
  });
});

function hslToRgb(h: number, s: number, l: number): number[] {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const lum = (c: readonly number[]) => {
    const [r, g, bl] = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
