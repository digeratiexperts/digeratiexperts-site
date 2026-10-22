/**
 * Social cards for a session, rendered from HTML to PNG with Playwright.
 *
 * Visual direction (a), Joe 2026-10-22: branded editorial, no generated
 * imagery. DE night ground, violet glow, the magenta date tile the session
 * page uses, Oxanium for dates and kickers, Space Grotesk headlines, and the
 * real wordmark from client/public/logo.png. Fonts and logo are inlined, so a
 * render never depends on the network.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DE_EVENT_TIME_ZONE, sessionStart } from "../../client/src/data/deEvents";
import { fill, ROOT, type CardSrc, type Kit } from "./render";

export const CARD_SIZES: [number, number][] = [
  [1200, 627],
  [1080, 1080],
];

const b64 = (p: string) => readFileSync(resolve(ROOT, p)).toString("base64");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fontFaces(): string {
  const face = (name: string, file: string, weight: string) =>
    `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${b64(`client/public/fonts/${file}`)}) format('woff2');font-weight:${weight};font-display:block}`;
  return [
    face("Oxanium", "oxanium-latin.woff2", "200 800"),
    face("Space Grotesk", "space-grotesk-latin.woff2", "300 700"),
    face("Inter", "inter-latin.woff2", "100 900"),
  ].join("\n");
}

export function cardHtml(kit: Kit, card: CardSrc, w: number, h: number): string {
  const t = kit.tokens;
  const start = sessionStart(kit.session);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: DE_EVENT_TIME_ZONE, ...o }).format(start);
  const square = h > w * 0.8;
  const s = w / 1200; // scale
  const headline = esc(fill(card.headline, t, `${kit.src.slug} card ${card.id}`));
  const quip = esc(fill(card.quip, t, `${kit.src.slug} card ${card.id}`));
  // The logo PNG is 500×500 with the mark at (29,183)–(466,289); crop to it.
  const logoW = 300 * s;
  const k = logoW / 437;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0}
html,body{width:${w}px;height:${h}px;background:#050312;overflow:hidden}
.c{position:relative;width:${w}px;height:${h}px;padding:${64 * s}px ${72 * s}px;color:#fff;font-family:Inter,sans-serif;display:flex;flex-direction:column;
background:radial-gradient(70% 60% at 85% 0%,rgba(91,69,224,.38),transparent 70%),radial-gradient(50% 50% at 0% 100%,rgba(211,18,106,.18),transparent 70%),#050312}
.top{display:flex;justify-content:space-between;align-items:center}
.logo{width:${logoW}px;height:${106 * k}px;overflow:hidden;position:relative}
.logo img{position:absolute;width:${500 * k}px;height:${500 * k}px;left:${-29 * k}px;top:${-183 * k}px}
.kicker{font:500 ${20 * s}px/1 Oxanium;letter-spacing:.18em;text-transform:uppercase;color:#F04C97}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${22 * s}px}
h1{font:700 ${(square ? 104 : 70) * s}px/1.02 'Space Grotesk';letter-spacing:-.025em;max-width:${(square ? 1060 : 1000) * s}px;text-wrap:balance}
.quip{font:400 ${(square ? 36 : 30) * s}px/1.35 Inter;color:rgba(255,255,255,.82);max-width:${900 * s}px;text-wrap:balance}
.bottom{display:flex;align-items:stretch;gap:${20 * s}px}
.tile{display:flex;border-radius:${12 * s}px;overflow:hidden;border:1px solid rgba(255,255,255,.12)}
.day{background:#D3126A;width:${104 * s}px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${10 * s}px 0}
.day b{font:700 ${46 * s}px/1 Oxanium}.day span{font:600 ${15 * s}px/1.5 Oxanium;letter-spacing:.12em;text-transform:uppercase}
.when{background:#151217;padding:${14 * s}px ${22 * s}px;display:flex;flex-direction:column;justify-content:center}
.when b{font:600 ${28 * s}px/1.2 'Space Grotesk'}.when span{font:400 ${18 * s}px/1.4 Inter;color:rgba(255,255,255,.78)}
.url{margin-left:auto;align-self:flex-end;font:500 ${18 * s}px/1.3 Oxanium;letter-spacing:.06em;color:rgba(255,255,255,.78);text-align:right}
.url b{display:block;color:#fff;font-weight:600}
</style></head><body><div class="c">
<div class="top"><div class="logo"><img src="data:image/png;base64,${b64("client/public/logo.png")}" alt=""></div><div class="kicker">${esc(card.kicker)}</div></div>
<div class="mid"><h1>${headline}</h1><p class="quip">${quip}</p></div>
<div class="bottom">
<div class="tile"><div class="day"><b>${part({ day: "numeric" })}</b><span>${part({ month: "short" })}</span></div>
<div class="when"><b>${esc(t.time)} – ${esc(t.end_time)}</b><span>${esc(part({ weekday: "long" }))} · Arizona time · ${esc(t.minutes)} min · Free</span></div></div>
${square ? "" : `<div class="url">With ${esc(t.presenter)}<b>digeratiexperts.com/events</b></div>`}
</div>
${square ? `<div class="url" style="margin:${24 * s}px 0 0;align-self:flex-start;text-align:left">With ${esc(t.presenter)}<b>digeratiexperts.com/events</b></div>` : ""}
</div></body></html>`;
}

function chromePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const local = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  return existsSync(local) ? local : undefined;
}

/** Writes docs/marketing/sessions/out/<slug>/cards/<id>-<w>x<h>.png for every card. */
export async function renderCards(kits: Kit[]): Promise<string[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: chromePath() });
  const written: string[] = [];
  try {
    for (const kit of kits) {
      const dir = resolve(ROOT, `docs/marketing/sessions/out/${kit.src.slug}/cards`);
      mkdirSync(dir, { recursive: true });
      for (const card of kit.src.cards) {
        for (const [w, h] of CARD_SIZES) {
          const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
          await page.setContent(cardHtml(kit, card, w, h), { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          const file = resolve(dir, `${card.id}-${w}x${h}.png`);
          writeFileSync(file, await page.screenshot({ type: "png" }));
          written.push(file);
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return written;
}
