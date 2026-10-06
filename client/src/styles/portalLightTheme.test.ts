import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Joe, 2026-10-06: the portal's light mode is "Light steps" (grey-ladder concept C), replacing the
// 2026-10-03 orchid "Ambient" field: a grey field, white cards one step up, the rail stays graphite.
const root = path.resolve(import.meta.dirname, "../../..");
const css = readFileSync(path.join(root, "client/src/styles/portal.css"), "utf8");
const layout = readFileSync(path.join(root, "client/src/pages/portal/PortalLayout.tsx"), "utf8");

function lightBlock(): string {
  const start = css.indexOf('.de-portal[data-theme="light"],\nbody.de-portal-scope[data-portal-theme="light"] {');
  expect(start, "light theme block").toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("portal light theme: Light steps", () => {
  it("paints the field grey with white cards one step up, and wells and hover in between", () => {
    const block = lightBlock();
    expect(block).toContain("--background: 255 11% 93%;");
    expect(block).toContain("--muted: 260 13% 95%;");
    expect(block).toContain("--accent: 252 11% 91%;");
    expect(block).toContain("--border: 257 11% 87%;");
    expect(block).toContain("--card: 0 0% 100%;");
    expect(block).not.toContain("--background: 290 42% 96%;");
  });

  it("drops the orchid glow, so the steps read as greys", () => {
    expect(css).not.toMatch(/radial-gradient\([^)]*rgb\(211 18 106 \/ 0\.13/);
    expect(css).not.toMatch(/radial-gradient\([^)]*rgb\(91 69 224/);
    expect(layout).toContain('<SidebarInset className="pt-canvas min-w-0 bg-background">');
  });

  it("keeps every state ink at 4.5:1 or better on its own tint over the grey surfaces", () => {
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
