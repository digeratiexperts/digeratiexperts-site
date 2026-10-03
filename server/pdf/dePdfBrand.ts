/**
 * Store client documents on the DE document system — the same tokens, type,
 * registers and page model as the resource PDFs (`scripts/de-documents/`,
 * approved record `design/approved/de-document-system-2026-10-03.md`).
 *
 * Transaction family: brief band (what this is, for whom, its status) →
 * spec body (numbered sections, line-item table, totals) → brief close
 * (next step and live contact links). Plain HTML/CSS that renders the same in
 * WeasyPrint and Chromium; tables carry the multi-column layout so neither
 * engine depends on grid support.
 */
import fs from "node:fs";
import path from "node:path";
import { COMPANY, PRIMARY_PHONE } from "@shared/companyContact";
import { DE_DOC_FONT_FACES, DE_DOC_FONTS_DIR, DE_DOC_TOKENS } from "@shared/deDocumentTokens";
import type { AccountTeam } from "@shared/accountManagers";
import { DE_LOGO_WHITE_DATA_URI } from "./deLogoWhiteDataUri";

export const T = DE_DOC_TOKENS;

export const DE_PDF = {
  graphite: T.ink,
  ink: T.ink,
  muted: T.muted,
  magenta: T.mag,
  website: "digeratiexperts.com",
  portal: "portal.digeratiexperts.com",
  brandName: "Digerati Experts",
  brandShort: "DE",
} as const;

/** Document IDs, in the same scheme as the resource PDFs (DE-DS-*, DE-CL-*, DE-RP-*). */
export const DE_STORE_DOC_ID = {
  quote: "DE-ST-QTE",
  order: "DE-ST-ORD",
  receipt: "DE-ST-RCP",
  solution: "DE-ST-SOL",
} as const;

const repoPath = (...p: string[]) => path.resolve(process.cwd(), ...p);

/**
 * Self-hosted static fonts, base64-embedded so neither renderer fetches over
 * the network. Missing files degrade to the system stack; the document still
 * renders.
 */
let fontCssCache: string | null = null;
export function brandFontFaceCss(): string {
  if (fontCssCache !== null) return fontCssCache;
  const dir = repoPath(DE_DOC_FONTS_DIR);
  const blocks: string[] = [];
  for (const [family, file, weight, style] of DE_DOC_FONT_FACES) {
    if (family.startsWith("Newsreader")) continue; // editorial register; not used by Store documents
    try {
      const b64 = fs.readFileSync(path.join(dir, `${file}.ttf`)).toString("base64");
      blocks.push(
        `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};` +
          `src:url(data:font/ttf;base64,${b64}) format("truetype");}`,
      );
    } catch {
      // One unreadable face falls back to the stack.
    }
  }
  fontCssCache = blocks.join("\n");
  return fontCssCache;
}

export const DE_FONT = {
  display: `"Space Grotesk", "Helvetica Neue", Arial, sans-serif`,
  body: `Inter, "Helvetica Neue", Arial, sans-serif`,
  label: `"Plex Mono", "Courier New", monospace`,
} as const;

let logoCache: string | null | undefined;
/** Reverse (white) logo for the graphite band: vector SVG from `brand/`, PNG fallback. */
export function logoDataUri(): string | null {
  if (logoCache !== undefined) return logoCache;
  try {
    const svg = fs.readFileSync(repoPath("brand", "digerati-logo-reverse.svg"));
    logoCache = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    logoCache = DE_LOGO_WHITE_DATA_URI || null;
  }
  return logoCache;
}

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** CSS string literal for `content:` in @page margin boxes. */
function cssString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

/** USD with thousands separators — the one money format for every document. */
export function usd(value: unknown): string {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function phoenixDate(date?: Date | string): string {
  const d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return safe.toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface RunningHead {
  /** e.g. "Preliminary quote · Q-2026-0042" */
  left: string;
  /** e.g. "DE-ST-QTE" */
  right: string;
}

/** Page model and the brief/spec register styles for Store documents. */
export function dePdfBaseStyles(head?: RunningHead): string {
  const label = `font-family:${DE_FONT.label};font-size:7pt;letter-spacing:.06em;color:${T.muted}`;
  const left = head ? `@top-left{content:${cssString(head.left.toUpperCase())};${label};margin-left:50pt;vertical-align:bottom;padding-bottom:12pt}` : "";
  const right = head ? `@top-right{content:${cssString(head.right.toUpperCase())};${label};margin-right:50pt;vertical-align:bottom;padding-bottom:12pt}` : "";
  return `
${brandFontFaceCss()}
@page{
  size:letter;
  margin:54pt 0 50pt;
  ${left}
  ${right}
  @bottom-left{content:"DIGERATI EXPERTS \\00B7  DIGERATIEXPERTS.COM";${label};margin-left:50pt;vertical-align:top;padding-top:14pt}
  @bottom-right{content:"PAGE " counter(page) " OF " counter(pages);${label};margin-right:50pt;vertical-align:top;padding-top:14pt}
}
@page:first{margin-top:0;@top-left{content:none}@top-right{content:none}}

*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:${DE_FONT.body};font-size:9.2pt;line-height:1.48;color:${T.ink};background:#fff}
a{color:inherit;text-decoration:none}
b,strong{font-weight:600}
h1,h2,h3{break-after:avoid;page-break-after:avoid}
p{orphans:3;widows:3}
tr,.keep,.pkg-head,.rec,.team,.panel{break-inside:avoid;page-break-inside:avoid}
.nowrap{white-space:nowrap}
.money,td.num{font-variant-numeric:tabular-nums}
.lbl{font-family:${DE_FONT.label};font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};font-weight:400}
.link{border-bottom:.7pt solid ${T.mag}}
/* Proportional (Inter) caps labels keep tracking at .03em. Chromium 151 breaks
   wider-tracked runs into separate text runs, and copy/paste and screen
   readers then read "SOLUTI ON PACK ET". Monospace labels (Plex Mono) are
   unaffected. */

/* ---------- brief band (page 1, full bleed) ---------- */
.band{background:${T.ink};color:#fff;padding:30pt 50pt 22pt}
.band-top{width:100%;border-collapse:collapse}
.band-top td{padding:0;vertical-align:middle}
.band-top td.r{text-align:right}
.band .logo{height:22pt;width:auto;display:block}
.band .brand-fallback{font-family:${DE_FONT.display};font-weight:600;font-size:13pt;letter-spacing:.04em}
.band .k{font-family:${DE_FONT.label};font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:#cfccd8}
.band .eyebrow{font-size:7.2pt;letter-spacing:.03em;text-transform:uppercase;font-weight:600;color:#cfccd8;margin-top:22pt}
.band h1{font-family:${DE_FONT.display};font-weight:600;font-size:28pt;line-height:1.05;letter-spacing:-.02em;color:#fff;margin-top:5pt}
.band .q{font-size:10.4pt;color:#e6e4ea;margin-top:7pt}
.band .stamp{display:inline-block;margin-top:12pt;border:1pt solid #fff;padding:2pt 7pt;font-size:7.2pt;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
.band-rule{height:3pt;background:${T.mag}}

/* spec strip: document identification under the band */
.specstrip{width:100%;border-collapse:collapse;border-bottom:.6pt solid ${T.rule}}
.specstrip td{padding:7pt 10pt 7pt 0;vertical-align:top;border-right:.6pt solid ${T.rule};padding-left:10pt}
.specstrip td:first-child{padding-left:50pt}
.specstrip td:last-child{border-right:0;padding-right:50pt}
.specstrip .lbl{display:block}
.specstrip .v{display:block;font-size:8.6pt;color:${T.ink};font-weight:500;margin-top:2pt;word-break:break-word}

.wrap{padding:0 50pt}

/* ---------- spec register ---------- */
.sec{margin-top:16pt}
.sec-head{border-top:.8pt solid ${T.ink};padding-top:7pt;margin-bottom:8pt;break-after:avoid;page-break-after:avoid}
.sec-head .no{font-family:${DE_FONT.label};font-weight:500;font-size:7.8pt;color:${T.magText};margin-right:9pt}
h2{display:inline;font-family:${DE_FONT.display};font-weight:600;font-size:12.5pt;line-height:1.2}
.empty{color:${T.muted};font-size:9pt;margin:4pt 0}
.intro{color:${T.ink2};margin-bottom:8pt}

/* line-item table, shared by order, receipt and quote */
table.items{width:100%;border-collapse:collapse;font-size:8.8pt;line-height:1.42}
table.items thead{display:table-header-group}
table.items th{font-family:${DE_FONT.label};font-weight:500;font-size:7pt;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};text-align:left;padding:0 8pt 5pt 0;border-bottom:1pt solid ${T.ink}}
table.items td{padding:6pt 8pt 6pt 0;border-bottom:.5pt solid ${T.rule};vertical-align:top}
table.items th.num,table.items td.num{text-align:right;white-space:nowrap}
table.items th:last-child,table.items td:last-child{padding-right:0}
table.items .item-name{font-weight:600}
table.items .item-sub{color:${T.ink2};font-size:8pt;margin-top:2pt}
table.items .ref{font-family:${DE_FONT.label};font-size:7pt;letter-spacing:.04em;color:${T.muted}}
table.items td.amount{font-weight:600}
.chip{display:inline-block;font-family:${DE_FONT.label};font-size:6.8pt;letter-spacing:.06em;text-transform:uppercase;padding:.5pt 4pt;margin-top:4pt;border:.7pt solid ${T.rule};color:${T.ink2}}
.chip.recurring{border-color:${T.ink};color:${T.ink}}

/* totals: right column, total ruled (no filled cells: they seam in viewers) */
table.totals{width:230pt;margin:8pt 0 0 auto;border-collapse:collapse}
table.totals td{padding:4pt 0;font-size:9pt;color:${T.ink2};border-bottom:.5pt solid ${T.rule}}
table.totals td.num{text-align:right;color:${T.ink};font-weight:500}
table.totals tr.total td{border-top:1.4pt solid ${T.ink};border-bottom:0;padding-top:7pt;color:${T.ink}}
table.totals tr.total .lbl{color:${T.ink}}
table.totals tr.total td.num{font-family:${DE_FONT.display};font-weight:600;font-size:16pt;letter-spacing:-.01em}

/* KPI row (quote investment summary) */
table.kpis{width:100%;border-collapse:separate;border-spacing:0}
table.kpis td{width:33.33%;vertical-align:top;padding:0 14pt 0 12pt;border-left:2pt solid ${T.ink}}
table.kpis .v{font-family:${DE_FONT.display};font-weight:600;font-size:20pt;letter-spacing:-.015em;line-height:1.05;margin-top:4pt}
table.kpis .u{font-size:8pt;color:${T.ink2};margin-top:3pt}

/* facts (solution summary) */
table.facts{width:100%;border-collapse:collapse}
table.facts td{width:33.33%;vertical-align:top;padding:6pt 12pt 6pt 0;border-bottom:.6pt solid ${T.rule}}
table.facts .v{font-weight:600;font-size:9.6pt;margin-top:2pt}

/* two panels (billed to / what happens next) */
table.two{width:100%;border-collapse:collapse;margin-top:16pt}
table.two > tbody > tr > td{width:50%;vertical-align:top}
table.two > tbody > tr > td:first-child{padding-right:12pt}
table.two > tbody > tr > td:last-child{padding-left:12pt}
.panel{border-top:.8pt solid ${T.ink};padding-top:7pt;font-size:8.8pt;color:${T.ink2}}
.panel .lbl{display:block;margin-bottom:4pt;color:${T.magText}}
.panel strong{color:${T.ink}}

/* solution packages */
.pkg{margin-top:10pt;break-inside:auto}
.pkg-head{border-left:2.4pt solid ${T.ink};padding:2pt 0 2pt 11pt;margin-bottom:4pt}
.pkg-family{font-size:7.2pt;letter-spacing:.03em;text-transform:uppercase;font-weight:600;color:${T.magText}}
.pkg-title{font-family:${DE_FONT.display};font-weight:600;font-size:11pt;margin-top:2pt}
.pkg-meta{font-family:${DE_FONT.label};font-size:7pt;letter-spacing:.04em;color:${T.muted};margin-top:3pt}
.pkg-meta span + span::before{content:"  \\00B7  ";color:${T.muted}}
table.lines{width:100%;border-collapse:collapse;font-size:8.8pt}
table.lines td{padding:4pt 8pt 4pt 0;border-bottom:.5pt solid ${T.rule};vertical-align:top}
table.lines td.qty{text-align:right;white-space:nowrap;color:${T.ink2};padding-right:0;width:30%}

/* notes from a request */
.callout{border-left:2.4pt solid ${T.ink};padding:5pt 0 5pt 12pt;color:${T.ink2}}

/* ---------- brief close ---------- */
table.rec{width:100%;border-collapse:collapse;margin-top:18pt;background:${T.paper}}
table.team{width:100%;border-collapse:collapse;margin-top:10pt;border:.7pt solid ${T.rule}}
table.team td{vertical-align:top}
table.team td.who{padding:8pt 12pt}
table.team td.dept{padding:8pt 12pt;width:36%;border-left:.7pt solid ${T.rule}}
.team .eyebrow{font-size:7.2pt;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:${T.magText};margin-bottom:4pt}
.team td.ph{width:34pt;padding:0 9pt 0 0;vertical-align:middle}
.team td.ph img{width:34pt;height:34pt;border-radius:50%;display:block}
.team .nm{font-weight:600;font-size:9.6pt}
.team .tt{color:${T.ink2};font-size:8.2pt;font-weight:400}
.team .ct{font-size:8.4pt;margin-top:3pt}
.team .ct a{margin-right:12pt}
table.rec td.bar{width:4pt;background:${T.mag};padding:0}
table.rec td.in{padding:10pt 15pt 11pt}
.rec .eyebrow{font-size:7.2pt;letter-spacing:.03em;text-transform:uppercase;font-weight:600;color:${T.magText}}
.rec h2{display:block;font-size:14pt;margin:3pt 0 4pt}
.rec p{color:${T.ink2}}
.rec .ct{margin-top:8pt;font-weight:600;font-size:8.8pt}
.rec .ct a{margin-right:16pt}
`;
}

/** Brief band: logo and document ID, then what this is, for whom, and its status. */
export function coverBlock(opts: {
  docId: string;
  eyebrow: string;
  title: string;
  subtitleParts: string[];
  stamp?: string;
}): string {
  const logo = logoDataUri();
  const sub = opts.subtitleParts.filter(Boolean).map(esc).join(" &nbsp;\u00B7&nbsp; ");
  return `<header class="band">
    <table class="band-top" role="presentation"><tr>
      <td>${logo ? `<img class="logo" src="${logo}" alt="${esc(DE_PDF.brandName)}"/>` : `<div class="brand-fallback">${esc(DE_PDF.brandName.toUpperCase())}</div>`}</td>
      <td class="r"><span class="k">${esc(opts.docId)}</span></td>
    </tr></table>
    <div class="eyebrow">${esc(opts.eyebrow)}</div>
    <h1>${esc(opts.title)}</h1>
    ${sub ? `<div class="q">${sub}</div>` : ""}
    ${opts.stamp ? `<div class="stamp">${esc(opts.stamp)}</div>` : ""}
  </header>
  <div class="band-rule"></div>`;
}

/** Spec strip: labelled identification cells under the band. */
export function specStrip(cells: [string, string][]): string {
  const tds = cells
    .filter(([, v]) => v)
    .map(([k, v]) => `<td><span class="lbl">${esc(k)}</span><span class="v">${esc(v)}</span></td>`)
    .join("");
  return `<table class="specstrip" role="presentation"><tr>${tds}</tr></table>`;
}

/** Numbered spec section heading; `body` is trusted HTML built by the caller. */
export function section(no: number, title: string, body: string): string {
  return `<section class="sec">
    <div class="sec-head"><span class="no">${String(no).padStart(2, "0")}</span><h2>${esc(title)}</h2></div>
    ${body}
  </section>`;
}

/** Brief close: next step and live contact links. `text` is escaped here. */
export function closeBlock(opts: { heading: string; text: string; email?: string; portal?: boolean }): string {
  const email = opts.email || COMPANY.email;
  return `<table class="rec" role="presentation"><tr><td class="bar"></td><td class="in">
    <div class="eyebrow">Next step</div>
    <h2>${esc(opts.heading)}</h2>
    <p>${esc(opts.text)}</p>
    <div class="ct">
      <a class="link" href="${esc(PRIMARY_PHONE.telHref)}">${esc(PRIMARY_PHONE.display)}</a>
      <a class="link" href="mailto:${esc(email)}">${esc(email)}</a>
      ${opts.portal ? `<a class="link" href="https://${DE_PDF.portal}">${DE_PDF.portal}</a>` : `<a class="link" href="https://${DE_PDF.website}">${DE_PDF.website}</a>`}
    </div>
  </td></tr></table>`;
}

const photoCache = new Map<string, string | null>();
/** Account manager headshot as a data URI (renderers never fetch over the network). */
export function accountPhotoDataUri(sitePath: string): string | null {
  if (photoCache.has(sitePath)) return photoCache.get(sitePath)!;
  let uri: string | null = null;
  for (const root of ["client/public", "dist/public"]) {
    try {
      const buf = fs.readFileSync(repoPath(root, sitePath.replace(/^\/+/, "")));
      uri = `data:image/jpeg;base64,${buf.toString("base64")}`;
      break;
    } catch {
      // try the next root
    }
  }
  photoCache.set(sitePath, uri);
  return uri;
}

/** "Your account team": assigned account manager (photo, title, contact) plus the sales department. */
export function accountTeamBlock(team: AccountTeam): string {
  const m = team.manager;
  const photo = accountPhotoDataUri(m.photo.jpg);
  return `<table class="team" role="presentation"><tr>
    <td class="who">
      <div class="eyebrow">Your account manager</div>
      <table role="presentation"><tr>
        ${photo ? `<td class="ph"><img src="${photo}" alt="${esc(m.photo.alt)}"/></td>` : ""}
        <td>
          <div class="nm">${esc(m.name)} <span class="tt">\u00B7 ${esc(m.title)}</span></div>
          <div class="ct"><a class="link" href="mailto:${esc(m.email)}">${esc(m.email)}</a><a class="link" href="${esc(m.phoneHref)}">${esc(m.phoneDisplay)}</a></div>
        </td>
      </tr></table>
    </td>
    <td class="dept">
      <div class="eyebrow">${esc(team.sales.name)}</div>
      <div class="ct"><a class="link" href="mailto:${esc(team.sales.email)}">${esc(team.sales.email)}</a></div>
      <div class="ct"><a class="link" href="${esc(team.sales.phoneHref)}">${esc(team.sales.phoneDisplay)}</a></div>
    </td>
  </tr></table>`;
}

/** Document shell: one H1 (in the band), language, title, styles. */
export function documentHtml(opts: { title: string; head: RunningHead; body: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(opts.title)}</title>
<style>${dePdfBaseStyles(opts.head)}</style>
</head><body>
${opts.body}
</body></html>`;
}
