import fs from "fs";
import path from "path";

/**
 * Self-hosted brand fonts for server-side PDF rendering, embedded as base64
 * @font-face so the renderer never depends on a font CDN (matches the site's
 * self-hosted fonts). Resolved from the first candidate path that exists so it
 * works in dev (source tree) and in the built/deployed tree.
 */

const FONT_FILES = {
  "Space Grotesk": "space-grotesk-latin.woff2",
  Inter: "inter-latin.woff2",
  Oxanium: "oxanium-latin.woff2",
} as const;

const CANDIDATE_DIRS = [
  path.resolve(process.cwd(), "public/v2/assets/fonts"),
  path.resolve(process.cwd(), "client/public/fonts"),
  path.resolve(process.cwd(), "dist/public/fonts"),
];

let cachedCss: string | null = null;

function resolveFontDir(): string | null {
  for (const dir of CANDIDATE_DIRS) {
    try {
      if (fs.existsSync(path.join(dir, FONT_FILES.Inter))) return dir;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Returns a <style> block of base64 @font-face rules, or "" if fonts are missing. */
export function brandFontFaceCss(): string {
  if (cachedCss !== null) return cachedCss;
  const dir = resolveFontDir();
  if (!dir) {
    cachedCss = "";
    return cachedCss;
  }
  const blocks: string[] = [];
  for (const [family, file] of Object.entries(FONT_FILES)) {
    try {
      const b64 = fs.readFileSync(path.join(dir, file)).toString("base64");
      const weight = family === "Oxanium" ? "500 700" : family === "Space Grotesk" ? "400 700" : "400 900";
      blocks.push(
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
          `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`,
      );
    } catch {
      /* skip a missing face rather than fail the whole document */
    }
  }
  cachedCss = blocks.join("\n");
  return cachedCss;
}

/** Canonical DE brand tokens shared by every PDF template. */
export const PDF_BRAND = {
  graphite: "#050312",
  graphite2: "#0d0920",
  paper: "#F7F5F2",
  magenta: "#D3126A",
  magentaInk: "#F04C97",
  electric: "#0891b2",
  electricInk: "#22d3ee",
} as const;

/** HTML-escape a user-supplied value for safe interpolation into a template. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a number as USD currency for display. */
export function usd(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
