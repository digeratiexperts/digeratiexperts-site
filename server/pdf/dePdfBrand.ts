/**
 * Shared DE PDF brand tokens for client-facing packets (Store solution,
 * preliminary quotes). Keep hex values in sync with Hub
 * `artifacts/api-server/src/lib/de-pdf-brand.ts` and the site Tier 2 field
 * ladder (graphite / paper / magenta).
 */
import fs from "node:fs";
import path from "node:path";
import { DE_LOGO_WHITE_DATA_URI } from "./deLogoWhiteDataUri";

export const DE_PDF = {
  graphite: "#050312",
  surface: "#0a0a0a",
  raised: "#151217",
  paper: "#F7F5F2",
  ink: "#1a1520",
  muted: "#6b6680",
  hairline: "rgba(255,255,255,0.12)",
  magenta: "#D3126A",
  magentaSoft: "#fce7f0",
  line: "#e8e4ee",
  website: "digeratiexperts.com",
  brandName: "Digerati Experts",
  brandShort: "DE",
} as const;

/**
 * Brand type stack for documents: Space Grotesk (display), Inter (body),
 * Oxanium (labels / reference numbers) — the same self-hosted woff2 files the
 * site serves, embedded as base64 so neither renderer fetches a font over the
 * network. Missing files degrade to the Helvetica/Arial fallback in the stack.
 */
const FONT_FACES = [
  { family: "Space Grotesk", file: "space-grotesk-latin.woff2", weight: "300 700" },
  { family: "Inter", file: "inter-latin.woff2", weight: "100 900" },
  { family: "Oxanium", file: "oxanium-latin.woff2", weight: "200 800" },
] as const;

const FONT_DIRS = [
  path.resolve(process.cwd(), "client/public/fonts"),
  path.resolve(process.cwd(), "dist/public/fonts"),
  path.resolve(process.cwd(), "public/v2/assets/fonts"),
];

let fontCssCache: string | null = null;

export function brandFontFaceCss(): string {
  if (fontCssCache !== null) return fontCssCache;
  const dir = FONT_DIRS.find((d) => fs.existsSync(path.join(d, FONT_FACES[1].file)));
  const blocks: string[] = [];
  if (dir) {
    for (const face of FONT_FACES) {
      try {
        const b64 = fs.readFileSync(path.join(dir, face.file)).toString("base64");
        blocks.push(
          `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};` +
            `src:url(data:font/woff2;base64,${b64}) format("woff2");}`,
        );
      } catch {
        // One unreadable face falls back to the stack; the document still renders.
      }
    }
  }
  fontCssCache = blocks.join("\n");
  return fontCssCache;
}

export const DE_FONT = {
  display: `"Space Grotesk", "Helvetica Neue", Arial, Helvetica, sans-serif`,
  body: `Inter, "Helvetica Neue", Arial, Helvetica, sans-serif`,
  label: `Oxanium, "Helvetica Neue", Arial, Helvetica, sans-serif`,
} as const;

/** White DE logo as a data URI (WeasyPrint cannot tint via CSS filters). */
export function logoDataUri(): string | null {
  return DE_LOGO_WHITE_DATA_URI || null;
}

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** USD with thousands separators — the one money format for every document. */
export function usd(value: unknown): string {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function phoenixDate(date?: Date | string): string {
  const d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString("en-US", {
      timeZone: "America/Phoenix",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Shared print CSS shell used by solution + quote packets. */
export function dePdfBaseStyles(): string {
  const { graphite, paper, ink, muted, magenta, magentaSoft, line } = DE_PDF;
  return `
  ${brandFontFaceCss()}
  @page {
    size: letter;
    margin: 18mm 0 16mm;
    @bottom-left {
      content: "${DE_PDF.brandName}  \\2022  Confidential";
      font-family: ${DE_FONT.label};
      font-size: 7.5px;
      color: ${muted};
      margin-left: 14mm;
    }
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-family: ${DE_FONT.label};
      font-size: 7.5px;
      color: ${muted};
      margin-right: 14mm;
    }
  }
  @page :first { margin-top: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ${DE_FONT.body};
    color: ${ink};
    font-size: 10.5px;
    line-height: 1.55;
    background: #fff;
  }
  .cover {
    background: ${graphite};
    color: #ffffff;
    padding: 36px 44px 28px;
  }
  .cover .logo { height: 30px; margin-bottom: 20px; }
  .cover .brand-fallback {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: .1em;
    margin-bottom: 20px;
  }
  .cover .eyebrow {
    font-size: 8.5px;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: #f9a8d4;
    font-weight: 700;
  }
  .cover h1 {
    font-size: 24px;
    margin: 8px 0 6px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .cover .sub { color: rgba(255,255,255,.7); font-size: 10px; }
  .accent {
    height: 4px;
    background: linear-gradient(90deg, ${magenta}, #ec4899, #a21caf);
  }
  .meta-strip {
    padding: 12px 44px;
    background: ${paper};
    border-bottom: 1px solid ${line};
    font-size: 9px;
    color: ${muted};
  }
  .meta-strip strong { color: ${ink}; }
  .wrap { padding: 0 44px 8px; }
  h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: ${magenta};
    margin: 22px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid ${line};
  }
  table.facts {
    width: 100%;
    border-collapse: collapse;
    margin: 2px 0 8px;
  }
  table.facts td {
    border: 1px solid ${line};
    padding: 10px 12px;
    width: 33.33%;
    vertical-align: top;
  }
  .facts .k {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: ${muted};
  }
  .facts .v {
    font-size: 12px;
    font-weight: 700;
    color: ${ink};
    margin-top: 2px;
  }
  .pkg {
    margin: 0 0 16px;
    page-break-inside: avoid;
    border: 1px solid ${line};
    border-radius: 10px;
    overflow: hidden;
  }
  .pkg-head {
    background: ${magentaSoft};
    padding: 12px 14px;
    border-bottom: 1px solid ${line};
  }
  .pkg-family {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: .14em;
    color: ${magenta};
    font-weight: 700;
    margin: 0 0 3px;
  }
  .pkg-title {
    font-size: 13px;
    font-weight: 800;
    color: ${ink};
    margin: 0;
  }
  .pkg-meta {
    font-size: 9px;
    color: ${muted};
    margin-top: 4px;
  }
  .pkg-meta span + span::before {
    content: "  \\00b7  ";
    color: ${muted};
  }
  .line {
    display: table;
    width: 100%;
    border-top: 1px solid ${line};
    page-break-inside: avoid;
  }
  .line-label, .line-qty {
    display: table-cell;
    padding: 8px 14px;
    font-size: 10px;
  }
  .line-label { color: ${ink}; }
  .line-qty {
    text-align: right;
    white-space: nowrap;
    color: ${muted};
    font-weight: 600;
    width: 28%;
  }
  .invest {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0 8px;
    background: ${magentaSoft};
  }
  .invest td {
    width: 33.33%;
    padding: 13px 16px;
    border: 1px solid #f3d0e1;
    vertical-align: top;
  }
  .invest .k {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: .14em;
    color: ${magenta};
    font-weight: 700;
  }
  .invest .v {
    font-size: 17px;
    font-weight: 800;
    color: ${graphite};
    margin-top: 2px;
  }
  .invest .note { font-size: 8px; color: ${muted}; margin-top: 2px; }
  .closing {
    margin: 20px 0 10px;
    padding: 13px 16px;
    background: ${paper};
    border: 1px solid ${line};
    font-size: 9px;
    color: ${muted};
  }
  .empty { color: ${muted}; font-size: 10px; margin: 8px 0; }

  /* Type roles. Display carries hierarchy; labels carry reference data;
     every money figure uses tabular figures so columns line up. */
  .cover h1, h2, .pkg-title, .facts .v, .invest .v, .doc-total .v {
    font-family: ${DE_FONT.display};
  }
  .cover .eyebrow, .facts .k, .invest .k, .pkg-family, .meta-strip,
  .chip, table.items th, .ref {
    font-family: ${DE_FONT.label};
  }
  .money, .invest .v, .line-qty, table.items td.num {
    font-variant-numeric: tabular-nums;
  }

  /* Line-item table shared by order, receipt and quote documents. */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin: 2px 0 10px;
  }
  table.items th {
    font-size: 7.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .14em;
    color: ${muted};
    text-align: left;
    padding: 0 10px 7px;
    border-bottom: 1.5px solid ${graphite};
  }
  table.items th.num, table.items td.num { text-align: right; white-space: nowrap; }
  table.items td {
    padding: 10px 10px;
    border-bottom: 1px solid ${line};
    vertical-align: top;
    font-size: 10px;
  }
  table.items tr { page-break-inside: avoid; }
  table.items .item-name { font-weight: 600; color: ${ink}; }
  table.items .item-sub { color: ${muted}; font-size: 8.5px; margin-top: 2px; }
  table.items td.amount { font-weight: 700; color: ${ink}; }
  .chip {
    display: inline-block;
    font-size: 7px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
    color: ${magenta};
    background: ${magentaSoft};
  }
  .chip.recurring { color: ${graphite}; background: #ece9f2; }

  /* Totals stack, right-aligned under the items table. */
  .doc-totals { width: 46%; margin: 6px 0 0 auto; border-collapse: collapse; }
  .doc-totals td { padding: 6px 10px; font-size: 10px; color: ${muted}; }
  .doc-totals td.num { text-align: right; color: ${ink}; font-weight: 600; }
  .doc-total td {
    background: ${graphite};
    color: #fff;
    padding: 10px;
  }
  .doc-total .k { font-size: 8px; text-transform: uppercase; letter-spacing: .16em; line-height: 22px; }
  .doc-total .v { font-size: 15px; font-weight: 700; float: right; line-height: 22px; }
  .nowrap { white-space: nowrap; }

  .two-col { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; }
  .two-col > tbody > tr > td { width: 50%; vertical-align: top; }
  .two-col > tbody > tr > td:first-child { padding-right: 12px; }
  .panel {
    border: 1px solid ${line};
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 9.5px;
    color: ${muted};
    page-break-inside: avoid;
  }
  .panel .k {
    font-family: ${DE_FONT.label};
    font-size: 7.5px;
    text-transform: uppercase;
    letter-spacing: .14em;
    color: ${magenta};
    font-weight: 700;
    margin-bottom: 6px;
  }
  .panel strong { color: ${ink}; }
`;
}

export function coverBlock(opts: {
  eyebrow: string;
  title: string;
  subtitleParts: string[];
}): string {
  const logo = logoDataUri();
  const sub = opts.subtitleParts.filter(Boolean).map(esc).join(" &nbsp;\u2022&nbsp; ");
  return `<div class="cover">
    ${logo ? `<img class="logo" src="${logo}" alt="${esc(DE_PDF.brandName)}"/>` : `<div class="brand-fallback">${esc(DE_PDF.brandName.toUpperCase())}</div>`}
    <div class="eyebrow">${esc(opts.eyebrow)}</div>
    <h1>${esc(opts.title)}</h1>
    <div class="sub">${sub}</div>
  </div>
  <div class="accent"></div>`;
}
