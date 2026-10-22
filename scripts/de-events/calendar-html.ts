/**
 * The DE event & campaign calendar as one self-contained page
 * (docs/marketing/de-event-calendar.html, also copied to WorkDrive).
 *
 * Joe, 2026-10-22: "Is the calendar cool and fun looking?" → "Use really good
 * UI design on it". Built to .claude/skills/premium-web-design:
 *   dark-first charcoal with a persisted light/dark toggle (system default, no flash);
 *   one magenta accent; one glass fold (the sticky filter bar); a poster hero
 *   where the numbers talk; a bento "Up next" sized by importance; three motion
 *   speeds (150/320/900ms, one easing) that honour reduced motion; sentence-case
 *   eyebrows; axe-clean at 390 and 1440, no sideways scroll.
 * Fun comes from the voice (docs/marketing/VOICE.md): one dry line per month,
 * never a statistic.
 *
 * Deterministic: nothing here reads the clock. "Today", countdowns, collapsing
 * past months and promoting the next session all happen in the browser.
 */

import type { DeEventSession } from "../../client/src/data/deEvents";
import type { Series, Weekday } from "./program";
import type { Item, Who } from "./build";

interface Input {
  items: Item[];
  months: string[];
  series: Series[];
  sessions: DeEventSession[];
  campaignName: (slug?: string) => string | undefined;
  site: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => utc(d).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
const to12h = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const AUD: Record<Who, string> = {
  prospects: "Prospects",
  clients: "Clients",
  internal: "Internal",
  "prospects-and-clients": "Prospects + clients",
};
/** Filter group for an entry: prep is its own layer. */
const layer = (it: Item) => (it.kind === "prep" ? "prep" : it.audience === "prospects-and-clients" ? "prospects" : it.audience);

/** One dry line per month (docs/marketing/VOICE.md). Situational, never a statistic. */
const QUIPS: Record<string, string> = {
  "01": "New year, same backups. This is the month we prove they restore.",
  "02": "Short month, long list. The internal IT teams get their turn.",
  "03": "World Backup Day on the 31st. Test the restore, not just the backup.",
  "04": "Tax season: when “the IRS” emails, it isn’t the IRS.",
  "05": "Small Business Week. Celebrate with an MFA rollout; nobody else will.",
  "06": "Halfway through the year. The tabletop exercise is the fun kind of breach.",
  "07": "Hot outside, hotter in the server closet.",
  "08": "Quiet month. Quiet months are for the jobs nobody wants in December.",
  "09": "Q3 wraps. QBR season is next, so the reports had better be real.",
  "10": "Cybersecurity Awareness Month: the one month everyone agrees passwords matter.",
  "11": "Renewal forms, invoice scams and a turkey. Busy month.",
  "12": "Invoices up, staff out, scammers thrilled. The holiday schedule goes out early.",
};

interface Detail {
  title: string;
  when: string;
  who: string;
  kind: string;
  note?: string;
  flag?: string;
  campaign?: [string, string];
  page?: string;
}

const KIND: Record<Item["kind"], string> = { session: "Live session", prep: "Session prep", series: "Rhythm", dated: "Dated event" };

function detail(it: Item, input: Input): Detail {
  const end = it.days && it.days > 1 ? addDays(it.date, it.days - 1) : undefined;
  const when = `${fmt(it.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}${
    end ? ` – ${fmt(end, { weekday: "short", month: "short", day: "numeric" })}` : ""
  }${it.time ? ` · ${to12h(it.time)} Arizona` : ""}`;
  const page = it.note?.match(/Page: (\/events\/[a-z0-9-]+)/)?.[1];
  return {
    title: it.title,
    when,
    who: AUD[it.audience],
    kind: KIND[it.kind],
    note: it.note?.replace(/\s*Page: \/events\/[a-z0-9-]+/, "").trim() || undefined,
    flag: it.flag,
    campaign: it.campaign ? [input.campaignName(it.campaign) ?? it.campaign, `${input.site}/go/${it.campaign}`] : undefined,
    page: page ? `${input.site}${page}` : undefined,
  };
}

const dataAttr = (d: Detail) => `data-d="${esc(JSON.stringify(d))}"`;
const short = (t: string) => t.split(":")[0];

function prepFor(it: Item, input: Input): string {
  const s = input.sessions.find((x) => it.title.includes(short(x.title)));
  return s ? (input.campaignName(s.campaign) ?? short(s.title)) : "";
}

function chip(it: Item, input: Input, extra = ""): string {
  const d = detail(it, input);
  const label =
    it.kind === "prep" ? `${short(it.title).replace(/^Prep /, "")} · ${prepFor(it, input)}`.replace(/ · $/, "") : short(it.title);
  const cls = it.kind === "session" ? `ev live ${it.flag === "confirmed" ? "conf" : "plan"}` : `ev ${layer(it)}`;
  const time = it.kind === "session" && it.time ? `<span class="t">${to12h(it.time)}</span>` : "";
  return `<button type="button" class="${cls}${extra}" data-l="${layer(it)}" ${dataAttr(d)} aria-label="${esc(`${d.kind}: ${it.title}, ${d.when}`)}">${time}<span class="x">${esc(label)}</span></button>`;
}

export function calendarHtml(input: Input): string {
  const { items, months, series, sessions, site } = input;
  const publicSessions = sessions.slice().sort((a, b) => a.start.localeCompare(b.start));
  const confirmed = publicSessions.filter((s) => s.status === "confirmed");
  const planned = publicSessions.filter((s) => s.status === "planned");
  const proposed = items.filter((it) => it.flag === "proposed");
  const range = `${fmt(months[0] + "-01", { month: "short", year: "numeric" })} – ${fmt(months[months.length - 1] + "-01", { month: "short", year: "numeric" })}`;

  /* ---------------------------------------------------------------- up next */
  const sessionCard = (s: DeEventSession, big: boolean) => {
    const date = s.start.slice(0, 10);
    const camp = input.campaignName(s.campaign) ?? s.campaign;
    return `<article class="card ${big ? "hero-card" : "sess-card"}" data-start="${s.start}" data-end-min="${s.durationMinutes}">
<p class="eyebrow">${big ? "Up next" : "Then"} · ${esc(s.format)}</p>
<div class="sess">
  <div class="tile" aria-hidden="true"><b>${fmt(date, { day: "numeric" })}</b><span>${fmt(date, { month: "short" })}</span></div>
  <div class="sess-main">
    <h3>${esc(short(s.title))}</h3>
    <p class="sub">${esc(s.title.split(":").slice(1).join(":").trim() || s.summary)}</p>
    <p class="meta">${fmt(date, { weekday: "long", month: "long", day: "numeric" })} · ${to12h(s.start.slice(11, 16))} Arizona · ${s.durationMinutes} min${
      s.presenter ? ` · ${esc(s.presenter)}` : ""
    }</p>
  </div>
</div>
${big ? `<div class="count" aria-live="off"><div><b data-u="d">–</b><span>days</span></div><div><b data-u="h">–</b><span>hours</span></div><div><b data-u="m">–</b><span>min</span></div><div><b data-u="s">–</b><span>sec</span></div></div>` : ""}
<p class="links"><a class="${big ? "btn" : "text-link"}" href="${site}/events/${s.slug}">Session page</a> <a class="text-link" href="${site}/go/${s.campaign}">${esc(camp)}</a></p>
</article>`;
  };
  const onDeck = [
    ...planned.map((s) => ({ date: s.start.slice(0, 10), title: short(s.title), tag: "Planned" })),
    ...proposed.map((it) => ({ date: it.date, title: it.title.replace(/^Webinar:\s*/, ""), tag: "Proposed" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const weekly = series
    .filter((s) => s.cadence === "weekly")
    .map((s) => {
      const wd = (s.recurrence as { weekday: Weekday }).weekday;
      const day = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri" }[wd];
      return `<li><span class="when">${day} ${to12h(s.time)}</span><span>${esc(short(s.title))}</span><i class="dot ${s.audience}" role="img" aria-label="${AUD[s.audience]}"></i></li>`;
    })
    .join("");

  const bento = `<section class="bento" aria-labelledby="next-h"><h2 id="next-h" class="sr">Up next</h2>
${confirmed[0] ? sessionCard(confirmed[0], true) : ""}
${confirmed[1] ? sessionCard(confirmed[1], false) : ""}
<article class="card deck"><p class="eyebrow">On deck, not yet confirmed</p><ul>${onDeck
    .slice(0, 6)
    .map((o) => `<li><span class="when">${fmt(o.date, { month: "short", day: "numeric" })}<small>${o.tag}</small></span><span class="tt" title="${esc(o.title)}">${esc(o.title)}</span></li>`)
    .join("")}</ul>${onDeck.length > 6 ? `<p class="fine">And ${onDeck.length - 6} more further out; see the months below.</p>` : ""}<p class="fine">Pages stay unpublished until Joe confirms date, presenter and platform.</p></article>
<article class="card rhythm"><p class="eyebrow">Every week, no exceptions</p><ul>${weekly}</ul></article>
</section>`;

  /* ------------------------------------------------------------- year strip */
  const strip = months
    .map((m) => {
      const list = items.filter((it) => it.date.startsWith(m) && it.kind !== "series");
      const live = list.filter((it) => it.kind === "session");
      const dots = live.map((it) => `<i class="pip ${it.flag === "confirmed" ? "conf" : "plan"}"></i>`).join("");
      return `<li><a href="#m-${m}" data-m="${m}"><span class="mo">${fmt(m + "-01", { month: "short" })}</span><span class="yr">${m.slice(0, 4)}</span><span class="pips" aria-hidden="true">${dots}</span><span class="sr">${
        live.length ? `${live.length} live session${live.length > 1 ? "s" : ""}` : "no live session"
      }</span></a></li>`;
    })
    .join("");

  /* ----------------------------------------------------------------- months */
  const monthBlocks = months
    .map((m) => {
      const [y, mm] = m.split("-").map(Number);
      const daysIn = new Date(Date.UTC(y, mm, 0)).getUTCDate();
      const lead = (new Date(Date.UTC(y, mm - 1, 1)).getUTCDay() + 6) % 7;
      const mStart = `${m}-01`;
      const mEnd = `${m}-${String(daysIn).padStart(2, "0")}`;

      const spans = items.filter((it) => it.days && it.days > 1 && it.date <= mEnd && addDays(it.date, it.days - 1) >= mStart);
      const track = spans
        .map((it) => {
          const s = it.date < mStart ? 1 : Number(it.date.slice(8));
          const endD = addDays(it.date, (it.days ?? 1) - 1);
          const e = endD > mEnd ? daysIn : Number(endD.slice(8));
          const left = ((s - 1) / daysIn) * 100;
          const width = ((e - s + 1) / daysIn) * 100;
          const d = detail(it, input);
          return `<button type="button" class="bar ${layer(it)}" data-l="${layer(it)}" style="--l:${left.toFixed(2)}%;--w:${width.toFixed(2)}%" ${dataAttr(d)} aria-label="${esc(
            `${it.title}, ${d.when}`,
          )}"><span class="x">${esc(short(it.title))}</span><span class="r">${s}–${e}</span></button>`;
        })
        .join("");

      const cells: string[] = [];
      for (let i = 0; i < lead; i++) cells.push(`<div class="c empty" aria-hidden="true"></div>`);
      for (let day = 1; day <= daysIn; day++) {
        const date = `${m}-${String(day).padStart(2, "0")}`;
        const dow = utc(date).getUTCDay();
        const list = items.filter((it) => it.date === date && !(it.days && it.days > 1) && !(it.kind === "series" && it.cadence === "weekly"));
        const live = list.filter((it) => it.kind === "session");
        const rest = list.filter((it) => it.kind !== "session").sort((a, b) => (a.kind === "prep" ? 1 : 0) - (b.kind === "prep" ? 1 : 0));
        const MAX = 3;
        const chips = [...live.map((it) => chip(it, input)), ...rest.map((it, i) => chip(it, input, i >= MAX ? " more" : ""))].join("");
        const moreBtn = rest.length > MAX ? `<button type="button" class="morebtn" aria-expanded="false">+${rest.length - MAX} more</button>` : "";
        cells.push(
          `<div class="c${list.length ? "" : " none"}${dow === 0 || dow === 6 ? " wknd" : ""}${live.length ? " has-live" : ""}" data-date="${date}"><p class="dn"><b>${day}</b><span class="dw">${fmt(date, {
            weekday: "short",
          })}</span></p>${chips}${moreBtn}</div>`,
        );
      }
      const camps = [...new Set(items.filter((it) => it.date.startsWith(m) && it.campaign && it.kind !== "prep").map((it) => it.campaign as string))]
        .map((c) => `<a class="camp" href="${site}/go/${c}">${esc(input.campaignName(c) ?? c)}</a>`)
        .join("");
      return `<section class="month" id="m-${m}" data-m="${m}" aria-labelledby="h-${m}">
<header class="mh"><div><h2 id="h-${m}">${fmt(mStart, { month: "long" })} <span>${y}</span></h2><p class="quip">${esc(QUIPS[m.slice(5)] ?? "")}</p></div>${
        camps ? `<div class="camps"><span class="fine">Campaigns</span>${camps}</div>` : ""
      }</header>
${track ? `<div class="track" aria-label="Running all month">${track}</div>` : ""}
<div class="grid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="h" aria-hidden="true">${d}</div>`).join("")}${cells.join("")}</div>
</section>`;
    })
    .join("\n");

  const count = items.filter((it) => it.kind !== "series").length + items.filter((it) => it.kind === "series").length;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DE Event Calendar</title>
<meta name="color-scheme" content="dark light">
<script>try{var t=localStorage.getItem("de-cal-theme");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){document.documentElement.dataset.theme="dark"}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oxanium:wght@600;700&family=Space+Grotesk:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--e:cubic-bezier(.2,.7,.2,1);--f:150ms;--p:320ms;--slow:900ms;--pop:#D3126A;--pop-h:#e01874;
--bg:#0a0a0a;--card:#1a1a1c;--card2:#141416;--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.16);--ink:#f5f5f7;--body:#c7c7cc;--muted:#a1a1a6;
--pink:#F04C97;--client:#5cc8f5;--internal:#b4b4bb;--prep:#8e8e96;--glass:rgba(10,10,10,.72);--tint:rgba(255,255,255,.04);--shadow:0 1px 0 rgba(255,255,255,.04) inset}
:root[data-theme=light]{--bg:#fafafa;--card:#ffffff;--card2:#f4f4f6;--line:rgba(0,0,0,.08);--line2:rgba(0,0,0,.16);--ink:#111114;--body:#4a4a4f;--muted:#5f5f66;
--pink:#A30E52;--client:#0369a1;--internal:#55555c;--prep:#6b6b72;--glass:rgba(250,250,250,.78);--tint:rgba(0,0,0,.035);--shadow:0 1px 2px rgba(0,0,0,.05),0 8px 24px rgba(0,0,0,.04)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;background:var(--bg);color:var(--body);font:15px/1.55 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;transition:background var(--p) var(--e),color var(--p) var(--e)}
a{color:inherit}h1,h2,h3{font-family:"Space Grotesk",Inter,sans-serif;font-weight:600;color:var(--ink);margin:0}
.wrap{max-width:1240px;margin:0 auto;padding:0 16px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
:focus-visible{outline:2px solid #ec4899;outline-offset:2px}
/* glass, once */
.bar-top{position:sticky;top:0;z-index:20;background:var(--glass);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.bar-top .wrap{display:flex;align-items:center;gap:12px;min-height:64px}
.brand{font:600 16px "Space Grotesk",sans-serif;color:var(--ink);text-decoration:none;white-space:nowrap}.brand b{color:var(--pop)}
.filters{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-left:auto;padding:4px 0}.filters::-webkit-scrollbar{display:none}
.fbtn,.theme{min-height:44px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--ink);font:500 14px Inter,sans-serif;padding:0 14px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap;transition:background var(--f) var(--e),border-color var(--f) var(--e),opacity var(--f) var(--e)}
.fbtn[aria-pressed=false]{opacity:.55;text-decoration:line-through;text-decoration-color:var(--muted)}
.fbtn:hover,.theme:hover{border-color:var(--ink)}
.theme{width:44px;padding:0;justify-content:center;flex:none}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none;background:var(--internal)}
.dot.prospects,.dot.prospects-and-clients{background:var(--pop)}.dot.clients{background:var(--client)}.dot.prep{background:transparent;border:1.5px dashed var(--prep)}
/* poster hero */
.hero{padding:clamp(56px,10vw,128px) 0 clamp(40px,6vw,72px)}
.eyebrow{font:500 13px Inter,sans-serif;color:var(--muted);margin:0 0 14px}
.hero h1{font-size:clamp(3rem,8.6vw,6.5rem);line-height:.96;letter-spacing:-.045em;max-width:12ch}
.hero h1 em{font-style:normal;color:var(--pop)}
.hero .lede{font-size:clamp(16px,1.6vw,19px);max-width:56ch;margin:24px 0 0}
.stats{display:flex;flex-wrap:wrap;gap:clamp(24px,5vw,64px);margin:44px 0 0;padding:0;list-style:none}
.stats b{display:block;font:600 clamp(2.2rem,4.4vw,3.4rem)/1 "Space Grotesk",sans-serif;letter-spacing:-.04em;color:var(--ink)}
.stats span{font-size:14px;color:var(--muted)}
/* bento */
.bento{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 40px}
.card{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:24px;box-shadow:var(--shadow);min-width:0}
.hero-card{grid-column:span 2;grid-row:span 2;background:#0b0b0d;color:#c7c7cc;border-color:rgba(255,255,255,.08);position:relative;overflow:hidden;display:flex;flex-direction:column}
.hero-card::before{content:"";position:absolute;inset:-40% -20% auto auto;width:70%;aspect-ratio:1;background:radial-gradient(circle,rgba(211,18,106,.32),transparent 65%);pointer-events:none}
.hero-card h3{color:#fff;font-size:clamp(1.9rem,3.2vw,2.7rem);line-height:1.02;letter-spacing:-.035em}
.hero-card .eyebrow,.hero-card .meta{color:#b8b8bf}.hero-card .sub{color:#d6d6db}
.sess-card{grid-column:span 2}
.sess{display:flex;gap:20px;align-items:flex-start;position:relative}
.tile{flex:none;width:96px;border-radius:18px;background:var(--pop);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 0;box-shadow:0 12px 32px rgba(211,18,106,.35)}
.tile b{font:700 46px/1 Oxanium,sans-serif}.tile span{font:600 14px Oxanium,sans-serif;margin-top:4px}
.sess-card .tile{width:72px;padding:10px 0;box-shadow:none}.sess-card .tile b{font-size:32px}
.sess-card h3{font-size:22px;letter-spacing:-.02em}
.sub{margin:8px 0 0;color:var(--body)}.meta{margin:10px 0 0;font-size:14px;color:var(--muted)}
.count{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:auto 0 0;padding-top:28px;position:relative}
.count div{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 8px;text-align:center}
.count b{display:block;font:700 clamp(28px,3.6vw,40px)/1 Oxanium,sans-serif;color:#fff;font-variant-numeric:tabular-nums}.count span{font-size:13px;color:#b8b8bf}
.links{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;margin:20px 0 0;position:relative}
.btn{display:inline-flex;align-items:center;min-height:56px;padding:0 28px;border-radius:999px;background:var(--pop);color:#fff;font:600 16px Inter,sans-serif;text-decoration:none;transition:background var(--f) var(--e)}
.btn:hover{background:var(--pop-h)}
.text-link{color:var(--ink);text-underline-offset:4px;text-decoration-color:var(--pop);font-weight:500}.hero-card .text-link{color:#fff}
.deck ul,.rhythm ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.rhythm .when{width:96px}
.deck li,.rhythm li{display:flex;gap:12px;align-items:baseline;font-size:14px;color:var(--ink)}
.when{flex:none;width:76px;font:600 13px Oxanium,sans-serif;color:var(--muted)}
.deck .tt{flex:1;min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.deck .when{width:64px}.deck .when small{display:block;font:500 11px Inter,sans-serif;color:var(--muted);margin-top:2px}
.deck em{flex:none;margin-left:auto;font-style:normal;font-size:12px;color:var(--muted);border:1px solid var(--line2);border-radius:999px;padding:1px 8px}
.rhythm li .dot{margin-left:auto;align-self:center}
.fine{font-size:12px;color:var(--muted)}.deck .fine{margin:14px 0 0}
/* year strip */
.year{margin:0 0 48px}.year h2{font-size:22px;margin:0 0 14px}
.strip{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(15,minmax(0,1fr));gap:6px}
.strip a{display:flex;flex-direction:column;gap:2px;min-height:76px;padding:10px 8px;border-radius:14px;background:var(--card);border:1px solid var(--line);text-decoration:none;transition:border-color var(--f) var(--e),transform var(--p) var(--e)}
.strip a:hover{border-color:var(--pop);transform:translateY(-2px)}
.strip a.now{border-color:var(--pop);box-shadow:0 0 0 1px var(--pop) inset}
.mo{font:600 15px "Space Grotesk",sans-serif;color:var(--ink)}.yr{font-size:12px;color:var(--muted)}
.pips{display:flex;gap:4px;margin-top:auto;min-height:10px}.pip{width:10px;height:10px;border-radius:50%;background:var(--pop)}.pip.plan{background:transparent;border:2px solid var(--pop)}
/* months */
.past-toggle{display:none;margin:0 0 16px}.has-past .past-toggle{display:inline-flex}
.month{background:var(--card);border:1px solid var(--line);border-radius:28px;padding:clamp(18px,2.4vw,28px);margin:0 0 20px;box-shadow:var(--shadow);opacity:1;transform:none;transition:opacity var(--slow) var(--e),transform var(--slow) var(--e)}
.month.pre{opacity:0;transform:translateY(12px)}
.month.past{display:none}.show-past .month.past{display:block}
.mh{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px 24px;align-items:flex-end;margin:0 0 18px}
.mh h2{font-size:clamp(28px,3.4vw,40px);letter-spacing:-.035em;line-height:1}.mh h2 span{color:var(--muted);font-weight:500}
.quip{margin:8px 0 0;max-width:62ch;color:var(--body)}
.camps{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.camp{font-size:13px;font-weight:500;color:var(--ink);text-decoration:none;border:1px solid var(--line2);border-radius:999px;padding:6px 12px;min-height:32px;display:inline-flex;align-items:center;transition:border-color var(--f) var(--e)}
.camp:hover{border-color:var(--pop)}
.track{position:relative;display:grid;gap:6px;margin:0 0 14px;padding:10px;border-radius:16px;background:var(--tint)}
.bar{position:relative;margin-left:var(--l);width:var(--w);min-width:120px;max-width:100%;min-height:34px;border:0;border-radius:999px;padding:0 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;font:500 13px Inter,sans-serif;color:var(--ink);cursor:pointer;background:var(--card);box-shadow:inset 3px 0 0 var(--internal);transition:filter var(--f) var(--e)}
.bar.prospects{box-shadow:inset 0 0 0 1px rgba(211,18,106,.45);background:rgba(211,18,106,.14)}.bar.clients{box-shadow:inset 0 0 0 1px var(--client)}
.bar.internal{box-shadow:inset 0 0 0 1px var(--line2)}
.bar:hover{filter:brightness(1.12)}.bar .x{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar .r{font:600 12px Oxanium,sans-serif;color:var(--muted);flex:none}
.grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.h{font:500 12px Inter,sans-serif;color:var(--muted);padding:0 6px 4px}
.c{min-height:104px;border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:4px;min-width:0;background:var(--card2);border:1px solid transparent;transition:border-color var(--f) var(--e)}
.c.empty{background:transparent}.c.wknd{background:transparent;border-color:var(--line)}
.c.today{border-color:var(--pop);box-shadow:0 0 0 1px var(--pop) inset}
.c.today .dn b{background:var(--pop);color:#fff;border-radius:999px;padding:0 7px}
.dn{margin:0 0 2px;display:flex;align-items:baseline;gap:6px}.dn b{font:600 13px Oxanium,sans-serif;color:var(--muted)}.dw{display:none}
.ev{display:flex;align-items:center;gap:6px;width:100%;min-height:26px;border:0;border-radius:8px;padding:3px 8px;background:transparent;color:var(--ink);font:500 12px/1.25 Inter,sans-serif;text-align:left;cursor:pointer;transition:background var(--f) var(--e)}
.ev::before{content:"";width:7px;height:7px;border-radius:50%;flex:none;background:var(--internal)}
.ev.prospects::before{background:var(--pop)}.ev.clients::before{background:var(--client)}.ev.prep{color:var(--muted)}.ev.prep::before{background:transparent;border:1.5px dashed var(--prep)}
.ev:hover{background:var(--tint)}.ev .x{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ev.live{background:var(--pop);color:#fff;font-weight:600;padding:6px 8px;flex-direction:column;align-items:flex-start;gap:2px;border-radius:10px}
.ev.live::before{display:none}.ev.live:hover{background:var(--pop-h)}.ev.live .t{font:600 11px Oxanium,sans-serif;opacity:.95}
.ev.live .x{max-width:100%;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ev.live.plan{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--pop)}.ev.live.plan .t{color:var(--pink)}
.ev.more{display:none}.c.open .ev.more{display:flex}
.morebtn{border:0;background:none;color:var(--pink);font:600 12px Inter,sans-serif;text-align:left;padding:3px 8px;min-height:26px;cursor:pointer}
.hide-prospects [data-l=prospects],.hide-clients [data-l=clients],.hide-internal [data-l=internal],.hide-prep [data-l=prep]{display:none!important}
/* dialog */
dialog{width:min(520px,calc(100vw - 32px));border:1px solid var(--line2);border-radius:24px;padding:28px;background:var(--card);color:var(--body);box-shadow:0 30px 80px rgba(0,0,0,.45)}
dialog::backdrop{background:rgba(0,0,0,.5);backdrop-filter:none}
dialog[open]{animation:pop var(--p) var(--e)}@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.98)}}
dialog h3{font-size:24px;line-height:1.15;letter-spacing:-.02em;margin:6px 0 10px}
dialog .k{font-size:13px;color:var(--muted);margin:0}dialog p{margin:8px 0}
dialog .flag{display:inline-block;font-size:12px;border:1px solid var(--pop);color:var(--pink);border-radius:999px;padding:2px 10px;margin:4px 0}
dialog .row{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;margin-top:18px}
.close{position:absolute;top:12px;right:12px;width:44px;height:44px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--ink);font-size:20px;cursor:pointer}
footer{padding:40px 0 72px;font-size:14px;color:var(--muted)}footer code{font:13px ui-monospace,monospace;color:var(--ink)}
/* responsive */
@media (max-width:1000px){.bento{grid-template-columns:repeat(2,minmax(0,1fr))}.strip{grid-template-columns:repeat(8,minmax(0,1fr))}}
@media (max-width:720px){
.bento{grid-template-columns:1fr}.hero-card,.sess-card{grid-column:auto;grid-row:auto}
.strip{grid-template-columns:repeat(5,minmax(0,1fr))}.strip a{min-height:64px;padding:8px 6px}
.brand{display:none}.filters{margin-left:0}.fbtn{padding:0 12px}
.grid{grid-template-columns:1fr;gap:4px}.h,.c.empty,.c.none{display:none}
.c{min-height:0;flex-direction:row;flex-wrap:wrap;align-items:flex-start;padding:10px;background:var(--card2);border:0}
.c.wknd{background:var(--card2)}
.dn{flex-direction:column;align-items:flex-start;gap:0;width:48px;flex:none;margin:0}.dn b{font-size:20px;color:var(--ink)}.dw{display:block;font-size:12px;color:var(--muted)}
.c>.ev,.c>.morebtn{flex:1 1 calc(100% - 60px);margin-left:56px}.c>.ev:first-of-type{margin-left:0;flex-basis:calc(100% - 60px)}
.ev .x{white-space:normal}.ev.more{display:flex}.morebtn{display:none}
.bar{min-width:0;margin-left:0;width:100%}
.count b{font-size:28px}.tile{width:80px}.tile b{font-size:38px}
}
@media (prefers-reduced-motion:reduce){*,*::before{transition:none!important;animation:none!important}html{scroll-behavior:auto}.month.pre{opacity:1;transform:none}}
</style></head><body>
<header class="bar-top"><div class="wrap">
<a class="brand" href="#top">DE <b>/</b> calendar</a>
<div class="filters" role="group" aria-label="Show layers">
<button type="button" class="fbtn" data-f="prospects" aria-pressed="true"><i class="dot prospects"></i><span class="lbl">Prospects</span></button>
<button type="button" class="fbtn" data-f="clients" aria-pressed="true"><i class="dot clients"></i><span class="lbl">Clients</span></button>
<button type="button" class="fbtn" data-f="internal" aria-pressed="true"><i class="dot internal"></i><span class="lbl">Internal</span></button>
<button type="button" class="fbtn" data-f="prep" aria-pressed="true"><i class="dot prep"></i><span class="lbl">Prep</span></button>
</div>
<button type="button" class="theme" aria-label="Switch to light theme"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>
</div></header>
<main id="top" class="wrap">
<section class="hero">
<p class="eyebrow">Digerati Experts · ${range} · Arizona time · program proposed, sessions confirmed one by one</p>
<h1>The year, planned. <em>Mostly.</em></h1>
<p class="lede">Every live session, client ritual and internal habit DE runs, on one page. Tap anything for the details. Filter the layers you care about up top. Season-long things run as bars; live sessions are the magenta blocks you can't miss.</p>
<ul class="stats">
<li><b>${confirmed.length}</b><span>live sessions confirmed</span></li>
<li><b>${planned.length + proposed.length}</b><span>more on deck</span></li>
<li><b>${count}</b><span>entries across ${months.length} months</span></li>
<li><b>${series.filter((s) => s.cadence === "weekly").length}</b><span>weekly rituals</span></li>
</ul>
</section>
${bento}
<section class="year" aria-labelledby="year-h"><h2 id="year-h">The year at a glance</h2><ul class="strip">${strip}</ul></section>
<button type="button" class="fbtn past-toggle" aria-expanded="false">Show past months</button>
${monthBlocks}
<footer>Generated by <code>npx tsx scripts/de-events/build.ts</code> from <code>scripts/de-events/program.ts</code> and <code>client/src/data/deEvents.ts</code>. Import <code>de-event-calendar.ics</code> into Zoho Calendar as its own layer. Times are Arizona (America/Phoenix), which never changes its clocks; everyone else does.</footer>
</main>
<dialog id="dlg" aria-labelledby="dlg-t"><button type="button" class="close" aria-label="Close">×</button><p class="k" id="dlg-k"></p><h3 id="dlg-t"></h3><p id="dlg-w"></p><p id="dlg-n"></p><p id="dlg-f"></p><div class="row" id="dlg-r"></div></dialog>
<script>
(function(){
var root=document.documentElement,body=document.body,themeBtn=document.querySelector(".theme");
function syncTheme(){var l=root.dataset.theme==="light";themeBtn.setAttribute("aria-label",l?"Switch to dark theme":"Switch to light theme");}
syncTheme();themeBtn.addEventListener("click",function(){root.dataset.theme=root.dataset.theme==="light"?"dark":"light";try{localStorage.setItem("de-cal-theme",root.dataset.theme)}catch(e){}syncTheme();});
document.querySelectorAll(".fbtn[data-f]").forEach(function(b){b.addEventListener("click",function(){var on=b.getAttribute("aria-pressed")!=="true";b.setAttribute("aria-pressed",String(on));body.classList.toggle("hide-"+b.dataset.f,!on);});});
var dlg=document.getElementById("dlg");
function el(id){return document.getElementById(id)}
function link(h,t,cls){var a=document.createElement("a");a.href=h;a.textContent=t;a.className=cls;return a}
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-d]");
  if(t){var d=JSON.parse(t.getAttribute("data-d"));el("dlg-k").textContent=d.kind+" · "+d.who;el("dlg-t").textContent=d.title;el("dlg-w").textContent=d.when;el("dlg-n").textContent=d.note||"";
    var f=el("dlg-f");f.textContent="";if(d.flag){var s=document.createElement("span");s.className="flag";s.textContent=d.flag;f.appendChild(s)}
    var r=el("dlg-r");r.textContent="";if(d.page)r.appendChild(link(d.page,"Session page","btn"));if(d.campaign)r.appendChild(link(d.campaign[1],d.campaign[0],"text-link"));
    dlg.showModal();return}
  var m=e.target.closest(".morebtn");if(m){var c=m.parentElement,o=c.classList.toggle("open");m.setAttribute("aria-expanded",String(o));m.textContent=o?"Show less":"+"+c.querySelectorAll(".ev.more").length+" more";return}
  if(e.target.closest(".close")||e.target===dlg)dlg.close();
});
/* today, past months, next session, countdowns: all from the viewer's clock */
var now=new Date(),fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Phoenix",year:"numeric",month:"2-digit",day:"2-digit"}),today=fmt.format(now),thisM=today.slice(0,7);
var cell=document.querySelector('.c[data-date="'+today+'"]');if(cell){cell.classList.add("today");cell.setAttribute("aria-current","date")}
var a=document.querySelector('.strip a[data-m="'+thisM+'"]');if(a){a.classList.add("now");a.setAttribute("aria-current","date")}
var past=0;document.querySelectorAll(".month").forEach(function(s){if(s.dataset.m<thisM){s.classList.add("past");past++}});
var pt=document.querySelector(".past-toggle");if(past){body.classList.add("has-past");pt.textContent="Show "+past+" past month"+(past>1?"s":"");pt.addEventListener("click",function(){var o=body.classList.toggle("show-past");pt.setAttribute("aria-expanded",String(o));pt.textContent=o?"Hide past months":"Show "+past+" past month"+(past>1?"s":"")})}
function tick(){document.querySelectorAll("[data-start]").forEach(function(c){var ms=new Date(c.dataset.start)-new Date(),u=c.querySelectorAll("[data-u]");if(!u.length)return;
  if(ms<=0){var over=new Date(c.dataset.start).getTime()+c.dataset.endMin*60000<Date.now();u[0].textContent=over?"Done":"Live";for(var i=1;i<u.length;i++)u[i].textContent="–";return}
  var s=Math.floor(ms/1000),v={d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60};u.forEach(function(x){x.textContent=v[x.dataset.u]})})}
tick();setInterval(tick,1000);
if("IntersectionObserver" in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches){var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.remove("pre");io.unobserve(x.target)}})},{rootMargin:"0px 0px -8% 0px"});
  document.querySelectorAll(".month").forEach(function(s){var r=s.getBoundingClientRect();if(r.top>innerHeight){s.classList.add("pre");io.observe(s)}})}
})();
</script>
</body></html>
`;
}
