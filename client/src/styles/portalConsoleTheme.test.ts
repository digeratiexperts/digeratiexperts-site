import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Joe, 2026-10-14: "a dark theme that is like Entra and IT dashboards" for the Client Portal.
// Opt-in "Admin console" theme: neutral greys, one blue accent, 4px corners, left-bar nav.
const root = path.resolve(import.meta.dirname, "../../..");
const css = readFileSync(path.join(root, "client/src/styles/portal.css"), "utf8");

function consoleBlock(): string {
  const start = css.indexOf('.de-portal[data-theme="console"],\nbody.de-portal-scope[data-portal-theme="console"] {');
  expect(start, "console theme block").toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

const hsl = (block: string, name: string) => {
  const m = block.match(new RegExp(`--${name}: (\\d+) (\\d+)% (\\d+)%;`));
  expect(m, name).not.toBeNull();
  return hslToRgb(Number(m![1]), Number(m![2]), Number(m![3]));
};

const rgb = (block: string, name: string) => {
  const m = block.match(new RegExp(`--pt-${name}: (\\d+) (\\d+) (\\d+);`));
  expect(m, name).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])] as const;
};

describe("portal admin console theme", () => {
  it("uses neutral greys with no violet cast, and square-ish corners", () => {
    const block = consoleBlock();
    for (const name of ["background", "card", "popover", "muted", "border", "sidebar-background"]) {
      expect(block).toMatch(new RegExp(`--${name}: 0 0% \\d+%;`));
    }
    expect(block).toContain("--radius: 0.25rem;");
  });

  it("keeps body and secondary text at 4.5:1 or better on every surface", () => {
    const block = consoleBlock();
    const surfaces = ["background", "card", "popover", "muted", "accent"].map((n) => hsl(block, n));
    for (const ground of surfaces) {
      expect(contrast(hsl(block, "foreground"), ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hsl(block, "muted-foreground"), ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(hsl(block, "primary-foreground"), hsl(block, "primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hsl(block, "destructive-foreground"), hsl(block, "destructive"))).toBeGreaterThanOrEqual(4.5);
    // Focus ring and field edges are non-text: 3:1 against the page.
    expect(contrast(hsl(block, "ring"), hsl(block, "background"))).toBeGreaterThanOrEqual(3);
    expect(contrast(hsl(block, "input"), hsl(block, "background"))).toBeGreaterThanOrEqual(3);
  });

  it("keeps every state ink at 4.5:1 or better on its own tint over the page, wells and cards", () => {
    const block = consoleBlock();
    const surfaces = { field: hsl(block, "background"), well: hsl(block, "muted"), card: hsl(block, "card") };
    for (const tone of ["ok", "warn", "bad", "info", "brand"]) {
      const ink = rgb(block, tone);
      const alphas = tone === "brand" ? [0.07, 0.08, 0.1, 0.12] : [0.07, 0.08, 0.1];
      for (const [surface, ground] of Object.entries(surfaces)) {
        for (const alpha of alphas) {
          const tint = ground.map((c, i) => ink[i] * alpha + c * (1 - alpha));
          expect(contrast(ink, tint), `${tone} on ${surface} @${alpha}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("turns the brand magenta tokens blue, with white text on the fill at 4.5:1", () => {
    const block = consoleBlock();
    const hex = (name: string) => {
      const m = block.match(new RegExp(`--${name}: #([0-9a-f]{6});`));
      expect(m, name).not.toBeNull();
      return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16));
    };
    expect(contrast([255, 255, 255], hex("de-magenta"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast([255, 255, 255], hex("de-magenta-hover"))).toBeGreaterThanOrEqual(4.5);
    for (const ground of ["background", "card", "muted"]) {
      expect(contrast(hex("de-magenta-ink"), hsl(block, ground))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("marks the selected nav item with a left bar, not the near-white pill", () => {
    expect(css).toMatch(/data-theme="console"[^{]*\.pt-active-nav\[data-active="true"\][^{]*\{[^}]*box-shadow: inset 3px 0 0/);
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
