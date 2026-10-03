// DE document system — components. Each returns semantic HTML that Chromium
// turns into tagged PDF structure (H1/H2, L/LI, Table/TH/TD, Figure, Link).
// Meaning never depends on colour: status uses words plus glyph shape.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pricing, type ProActiveTierKey } from "../../../client/src/data/pricing";
import { COMPANY, PRIMARY_PHONE } from "../../../shared/companyContact";
import { BRAND_DIR } from "./paths.mts";
import { TOKENS as T } from "./styles.mts";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline **bold** only; everything else escaped. */
export const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

// ---------- types ----------
export type Status = "in" | "out" | "add";
export interface Cta { label: string; detail: string; href: string; hrefLabel: string }
export interface Aside {
  tier?: ProActiveTierKey; // price box from pricing.ts
  box?: { label: string; value: string; unit?: string; more?: string };
  facts?: { label: string; value: string }[];
}
export interface EdSection { rail: string; h: string; id?: string; paras?: string[]; steps?: string[]; terms?: [string, string][]; list?: string[]; figure?: { svg: string; alt: string; caption?: string } }
export interface Takeaway { b: string; s: string }
export type Block =
  | { t: "section"; title: string; id?: string; intro?: string; body: Block[]; breakBefore?: boolean; keep?: boolean }
  | { t: "cols"; items: Block[] }
  | { t: "list"; items: string[]; style?: "tick" | "num" }
  | { t: "p"; text: string }
  | { t: "h3"; text: string }
  | { t: "scope"; rows: { cap: string; st: Status; detail: string }[] }
  | { t: "table"; head: string[]; rows: string[][]; rowHeader?: boolean; caption?: string; cur?: number; widths?: string[]; label?: string }
  | { t: "ladder"; current?: ProActiveTierKey; caption?: string }
  | { t: "flow"; steps: { step: string; detail: string }[]; label?: string; prefix?: string }
  | { t: "figure"; svg: string; alt: string; caption?: string }
  | { t: "callout"; kind: "note" | "boundary" | "example"; label: string; text: string }
  | { t: "checks"; groups: { title: string; items: { area: string; q: string }[] }[] }
  | { t: "notes"; label: string; height?: number }
  | { t: "takeaways"; items: Takeaway[]; title?: string }
  | { t: "editorial"; title?: string; stand?: string; sections: EdSection[]; masthead?: boolean; close?: boolean; inline?: boolean }
  | { t: "break" }
  | { t: "rec" };

// ---------- brand ----------
// The logo is embedded as an <img> with an SVG data URI: it stays vector, and
// Chromium tags it as a Figure with alt text.
const LOGO_URI = {
  light: `data:image/svg+xml;base64,${Buffer.from(readFileSync(path.join(BRAND_DIR, "digerati-logo.svg"))).toString("base64")}`,
  reverse: `data:image/svg+xml;base64,${Buffer.from(readFileSync(path.join(BRAND_DIR, "digerati-logo-reverse.svg"))).toString("base64")}`,
};
export const logo = (kind: "light" | "reverse" = "light") =>
  `<img class="logo" src="${LOGO_URI[kind]}" alt="Digerati Experts">`;

// ---------- page furniture ----------
export function masthead(doc: { family: string; docId: string; edition: string }) {
  const fam = doc.family[0].toUpperCase() + doc.family.slice(1);
  return `<header class="masthead">${logo()}<div class="spec" aria-label="Document identification">
<div>TYPE<b>${esc(fam)}</b></div><div>DOC<b>${esc(doc.docId)}</b></div><div>EDITION<b>${esc(doc.edition)}</b></div></div></header>`;
}

export function aside(a: Aside | undefined) {
  if (!a) return "";
  let box = "";
  if (a.tier) {
    const p = pricing[a.tier];
    box = `<div class="box" aria-label="Published starting point"><p class="lbl">Published starting rate</p><p class="v">$${p.user}</p><p class="u">per user per month</p><p class="m"><b>$${p.monthlyMinimum.toLocaleString("en-US")}</b> monthly minimum</p></div>`;
  } else if (a.box) {
    box = `<div class="box"><p class="lbl">${esc(a.box.label)}</p><p class="v" style="font-size:17pt;line-height:1.15">${esc(a.box.value)}</p>${a.box.unit ? `<p class="u">${esc(a.box.unit)}</p>` : ""}${a.box.more ? `<p class="m">${md(a.box.more)}</p>` : ""}</div>`;
  }
  const facts = a.facts?.length
    ? `<dl class="facts">${a.facts.map((f) => `<div><dt class="lbl">${esc(f.label)}</dt><dd>${md(f.value)}</dd></div>`).join("")}</dl>`
    : "";
  return `<div class="aside">${box}${facts}</div>`;
}

// ---------- spec blocks ----------
export const statusText: Record<Status, string> = { in: "Included", out: "Not included", add: "Scoped add-on" };

function scope(rows: { cap: string; st: Status; detail: string }[]) {
  return `<table><thead><tr><th scope="col" style="width:31%">Capability</th><th scope="col" style="width:15%">Status</th><th scope="col">Detail</th></tr></thead><tbody>
${rows.map((r) => `<tr><th scope="row">${esc(r.cap)}</th><td class="st"><span class="g ${r.st}" aria-hidden="true"></span>${statusText[r.st]}</td><td class="d">${md(r.detail)}</td></tr>`).join("")}
</tbody></table>
`;
}

function table(b: Extract<Block, { t: "table" }>) {
  const cols = b.widths ? `<colgroup>${b.widths.map((w) => `<col style="width:${w}">`).join("")}</colgroup>` : "";
  return `<table${b.label ? ` aria-label="${esc(b.label)}"` : ""}>${cols}<thead><tr>${b.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>
${b.rows.map((r, i) => `<tr${b.cur === i ? ' class="cur"' : ""}>${r.map((c, j) => (j === 0 && b.rowHeader ? `<th scope="row">${md(c)}</th>` : `<td${j > 0 ? ' class="d"' : ""}>${md(c)}</td>`)).join("")}</tr>`).join("")}
</tbody>${b.caption ? `<caption>${md(b.caption)}</caption>` : ""}</table>`;
}

const LADDER_ADDS: Record<ProActiveTierKey, string> = {
  it: "Service desk, DE Security Foundation, security monitoring baseline, awareness",
  office: "Managed network, endpoint backup, 24/7 managed detection and response, annual review",
  business: "Backup and DR posture, compliance and risk reporting, semi-annual reviews",
  enterprise: "Privileged access elements, advanced reporting, quarterly executive reviews",
};
function wrap(t: string, n: number) {
  const out: string[] = [];
  let cur = "";
  for (const w of t.split(" ")) {
    if ((cur + " " + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += " " + w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/** The four ProActive levels as a stepped diagram. Rates and minimums come from pricing.ts. */
export function ladder(current?: ProActiveTierKey, caption?: string) {
  const keys: ProActiveTierKey[] = ["it", "office", "business", "enterprise"];
  const W = 512, base = 118, colW = 116, gap = 16, x0 = 0, hs = [32, 48, 64, 80];
  let g = `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="${T.ink}" stroke-width="1"/>`;
  keys.forEach((k, i) => {
    const p = pricing[k], x = x0 + i * (colW + gap), h = hs[i], y = base - h, cur = k === current;
    g += `<rect x="${x}" y="${y}" width="${colW}" height="${h}" fill="${cur ? T.ink : T.tint}" stroke="${T.ink}" stroke-width="${cur ? 0 : 0.8}"/>`;
    g += `<text x="${x + 8}" y="${y + 15}" font-family="Space Grotesk" font-weight="600" font-size="10.5" fill="${cur ? "#fff" : T.ink}">${esc(p.name)}</text>`;
    g += `<text x="${x + 8}" y="${y + 27}" font-family="Plex Mono" font-size="7" fill="${cur ? "#e4e2e8" : T.ink2}">$${p.user}/user · $${p.monthlyMinimum.toLocaleString("en-US")} min</text>`;
    g += `<text x="${x}" y="${base + 12}" font-family="Plex Mono" font-size="7" fill="${T.muted}">LEVEL ${i + 1}${cur ? " · THIS DOCUMENT" : ""}</text>`;
    const lines = wrap(LADDER_ADDS[k], 31);
    lines.forEach((ln, j) => {
      g += `<text x="${x}" y="${y - 6 - (lines.length - 1 - j) * 8.4}" font-family="Inter" font-size="7" fill="${T.ink2}">${esc(ln)}</text>`;
    });
  });
  const alt = `Stepped diagram of the four ProActive levels. ${keys
    .map((k) => `${pricing[k].label}: $${pricing[k].user} per user per month, $${pricing[k].monthlyMinimum.toLocaleString("en-US")} monthly minimum; lists ${LADDER_ADDS[k].charAt(0).toLowerCase()}${LADDER_ADDS[k].slice(1)}`)
    .join(". ")}.${current ? ` This document covers ${pricing[current].label}.` : ""}`;
  return `<figure class="ladder-fig" role="img" aria-label="${esc(alt)}"><svg viewBox="0 0 ${W} ${base + 18}" width="100%" aria-hidden="true">${g}</svg>
<figcaption>${esc(caption ?? "Labels name items from each level's published inclusions. Rates are per user per month, with monthly minimums. Levels describe operating depth, not a ranking.")}</figcaption></figure>`;
}

function flow(b: Extract<Block, { t: "flow" }>) {
  const n = b.steps.length;
  return `<ol class="flow" style="grid-template-columns:repeat(${n},1fr)"${b.label ? ` aria-label="${esc(b.label)}"` : ""}>${b.steps
    .map((s, i) => `<li><span class="n">${esc(b.prefix ?? "STEP")} ${String(i + 1).padStart(2, "0")}</span><b>${esc(s.step)}</b><span>${md(s.detail)}</span></li>`)
    .join("")}</ol>`;
}

function checks(b: Extract<Block, { t: "checks" }>, start: { n: number }) {
  return b.groups
    .map(
      (g) => `<div class="group-head keep"><h3>${esc(g.title)}</h3><span class="lbl">${g.items.length} check${g.items.length > 1 ? "s" : ""}</span></div>
<ul class="checks">${g.items
        .map((it) => {
          const id = `C${String(++start.n).padStart(2, "0")}`;
          return `<li class="check"><span class="id">${id}</span><p class="q"><span class="area">${esc(it.area)}</span>${esc(it.q)}</p>
<p class="boxes" aria-label="Mark one: Yes, No or Unknown"><span><i aria-hidden="true"></i>Yes</span><span><i aria-hidden="true"></i>No</span><span><i aria-hidden="true"></i>Unknown</span></p>
<p class="notes" aria-label="Notes">NOTES / OWNER</p></li>`;
        })
        .join("")}</ul>`,
    )
    .join("");
}

// ---------- editorial ----------
function editorial(b: Extract<Block, { t: "editorial" }>, doc: DocLike) {
  const secs = b.sections
    .map(
      (s) => `<section class="ed keep"><p class="rail" aria-hidden="true">${esc(s.rail)}</p><div><h2${s.id ? ` id="${s.id}"` : ""}>${esc(s.h)}</h2>
${(s.paras ?? []).map((p) => `<p>${md(p)}</p>`).join("")}
${s.steps ? `<ol class="steps">${s.steps.map((x) => `<li>${md(x)}</li>`).join("")}</ol>` : ""}
${s.list ? `<ul class="ed-list">${s.list.map((x) => `<li>${md(x)}</li>`).join("")}</ul>` : ""}
${s.figure ? `<figure class="ed-fig" role="img" aria-label="${esc(s.figure.alt)}">${s.figure.svg}${s.figure.caption ? `<figcaption>${md(s.figure.caption)}</figcaption>` : ""}</figure>` : ""}
${s.terms ? `<dl class="terms">${s.terms.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${md(d)}</dd></div>`).join("")}</dl>` : ""}
</div></section>`,
    )
    .join("");
  const head = b.masthead ? masthead(doc) : "";
  const title = b.title ? `<h1 class="ed-title">${esc(b.title)}</h1>` : "";
  const stand = b.stand ? `<p class="ed-stand">${md(b.stand)}</p>` : "";
  return `<div class="${b.inline ? "editorial-inline" : "editorial"}">${head}${title}${stand}${secs}${b.close ? rec(doc) : ""}</div>`;
}

// ---------- brief ----------
export function takeaways(items: Takeaway[], title = "Three things to know") {
  return `<h2 class="brief-h">${esc(title)}</h2><ol class="take" style="grid-template-columns:repeat(${items.length},1fr)">${items
    .map((t, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><b>${md(t.b)}</b><span>${md(t.s)}</span></li>`)
    .join("")}</ol>`;
}

export interface DocLike {
  family: string; docId: string; edition: string; title: string; cta: Cta; scopeNote?: string;
}
export function rec(doc: DocLike) {
  const c = doc.cta;
  return `<aside class="rec" aria-label="Next step"><div class="bar" aria-hidden="true"></div><div class="in">
<p class="eyebrow">Next step</p><h2>${esc(c.label)}</h2><p>${md(c.detail)}</p>
<p class="ct"><a class="link" href="${esc(c.href)}">${esc(c.hrefLabel)}</a><a class="link" href="${CONTACT.telHref}">${CONTACT.phone}</a><a class="link" href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
${scopeNote(doc)}</div></aside>`;
}
export const scopeNote = (doc: DocLike) => (doc.scopeNote ? `<p class="scope-note">${md(doc.scopeNote)}</p>` : "");

export const CONTACT = { phone: PRIMARY_PHONE.display, telHref: PRIMARY_PHONE.telHref, email: COMPANY.email };

// ---------- block renderer ----------
export function renderBlocks(blocks: Block[], doc: DocLike, ctx = { sec: 0, check: { n: 0 } }): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case "section": {
          const n = String(++ctx.sec).padStart(2, "0");
          const id = b.id ?? `s${n}`;
          return `<section class="sec${b.breakBefore ? " break" : ""}${b.keep ? " keep" : ""}" aria-labelledby="${id}"><div class="sec-head"><span class="no" aria-hidden="true">${n}</span><h2 id="${id}">${esc(b.title)}</h2></div>
${b.intro ? `<p class="intro">${md(b.intro)}</p>` : ""}${renderBlocks(b.body, doc, ctx)}</section>`;
        }
        case "cols":
          return `<div class="cols">${renderBlocks(b.items, doc, ctx)}</div>`;
        case "list":
          return b.style === "num"
            ? `<ol class="num">${b.items.map((x, i) => `<li><span class="n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span>${md(x)}</span></li>`).join("")}</ol>`
            : `<ul class="tick">${b.items.map((x) => `<li>${md(x)}</li>`).join("")}</ul>`;
        case "p":
          return `<p class="intro">${md(b.text)}</p>`;
        case "h3":
          return `<h3>${esc(b.text)}</h3>`;
        case "scope":
          return scope(b.rows);
        case "table":
          return table(b);
        case "ladder":
          return ladder(b.current, b.caption);
        case "flow":
          return flow(b);
        case "figure":
          return `<figure class="keep" role="img" aria-label="${esc(b.alt)}">${b.svg}${b.caption ? `<figcaption>${md(b.caption)}</figcaption>` : ""}</figure>`;
        case "callout":
          return `<div class="callout ${b.kind}"><span class="lbl">${esc(b.label)}</span><p>${md(b.text)}</p></div>`;
        case "checks":
          return checks(b, ctx.check);
        case "notes":
          return `<div class="notes-box" style="--h:${b.height ?? 90}pt"><span class="lbl">${esc(b.label)}</span></div>`;
        case "takeaways":
          return takeaways(b.items, b.title);
        case "editorial":
          return editorial(b, doc);
        case "break":
          return `<div class="break" aria-hidden="true"></div>`;
        case "rec":
          return rec(doc);
      }
    })
    .join("\n");
}
