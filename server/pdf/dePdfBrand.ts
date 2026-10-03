/**
 * Shared DE PDF brand tokens for client-facing packets (Store solution,
 * preliminary quotes). Keep hex values in sync with Hub
 * `artifacts/api-server/src/lib/de-pdf-brand.ts` and the site Tier 2 field
 * ladder (graphite / paper / magenta).
 */
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
  @page {
    size: letter;
    margin: 18mm 0 16mm;
    @bottom-left {
      content: "${DE_PDF.brandName} \\2022 Confidential";
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.5px;
      color: ${muted};
      margin-left: 14mm;
    }
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.5px;
      color: ${muted};
      margin-right: 14mm;
    }
  }
  @page :first { margin-top: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
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
    content: " · ";
    color: ${line};
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
