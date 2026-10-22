// Plain-SVG Dex for places that have no React: email signatures, Zoho Desk and Zoho CRM templates, server-rendered
// pages, and any other app. Same geometry as the site component, with no CSS or scripts. The output is a static
// pose: motion needs the site stylesheet, so an email or Desk template shows the resting shape of each mode.
import { BAR_H, DEX_MODES, DEX_VIEWBOX, EYE_RX, EYE_RY, GLYPHS, GLYPH_TRANSFORM, MARK_BARS, eyePoses, type DexMode } from "./dexGeometry";
import type { Holiday } from "./holidays";

export interface RenderDexOptions {
  mode?: DexMode;
  size?: number;
  /** Accessible name. Omit for a decorative mark. */
  title?: string;
  holiday?: Holiday | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderDexSvg({ mode = "normal", size = 96, title, holiday = null }: RenderDexOptions = {}): string {
  const pose = DEX_MODES[mode];
  const a11y = title ? `role="img" aria-label="${esc(title)}"` : `aria-hidden="true"`;
  const bars = MARK_BARS.map(
    (b, i) =>
      `<g transform="translate(${pose.barX[i]} 0)"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${BAR_H}" rx="${BAR_H / 2}" fill="url(#dex-gold)"/><rect x="${b.x + 3}" y="${b.y + 1.3}" width="${b.w - 6}" height="1.6" rx="0.8" fill="#fff" opacity=".35"/></g>`,
  ).join("");
  const eyes = eyePoses(pose)
    .map((e) => `<g transform="translate(${e.x} ${e.y}) scale(1 ${e.sy})"><ellipse cx="0" cy="0" rx="${EYE_RX}" ry="${EYE_RY}" fill="#121212"/></g>`)
    .join("");
  const glyph = holiday
    ? (() => {
        const g = GLYPHS[holiday.glyph];
        const paint =
          g.paint === "fill"
            ? `fill="${holiday.accent}"`
            : `fill="none" stroke="${holiday.accent}" stroke-width="1.1" stroke-linecap="round"`;
        return `<g transform="${GLYPH_TRANSFORM}"><path d="${g.d}" ${paint}/></g>`;
      })()
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${DEX_VIEWBOX}" width="${size}" height="${(size * 68.5) / 56}" ` +
    `data-mode="${mode}"${holiday ? ` data-holiday="${holiday.id}"` : ""} ${a11y}>` +
    `<defs><linearGradient id="dex-gold" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#F6D27A"/><stop offset=".45" stop-color="#E3B23C"/><stop offset="1" stop-color="#B9862A"/>` +
    `</linearGradient></defs>${bars}${eyes}${glyph}</svg>`
  );
}
