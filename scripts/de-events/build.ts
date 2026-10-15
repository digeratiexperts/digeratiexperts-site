/**
 * Renders the DE operating calendar (scripts/de-events/program.ts plus the
 * public sessions in client/src/data/deEvents.ts) into docs/marketing/:
 *
 *   DE-EVENT-CALENDAR.md     month-by-month plan, readable on GitHub
 *   de-event-calendar.ics    import into Zoho Calendar, Google or Outlook
 *   de-event-calendar.html   self-contained year view (also copied to WorkDrive)
 *
 * Usage:  npx tsx scripts/de-events/build.ts          (write)
 *         npx tsx scripts/de-events/build.ts --check  (fail if stale)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DE_EVENT_SESSIONS } from "../../client/src/data/deEvents";
import { CAMPAIGNS } from "../../client/src/data/campaigns";
import { buildIcs, type IcsEvent } from "../../client/src/lib/ics";
import { DATED, SERIES, SESSION_PREP, type Audience, type Recurrence, type Weekday } from "./program";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "docs/marketing");
const RANGE_START = "2026-10-01";
const RANGE_END = "2027-12-31";
/** Fixed so --check is deterministic; bump when the programme changes. */
const STAMP = new Date("2026-10-10T00:00:00Z");
const SITE = "https://digeratiexperts.com";

type Kind = "session" | "prep" | "series" | "dated";
type Who = Audience | "prospects-and-clients";

interface Item {
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  days?: number;
  title: string;
  audience: Who;
  kind: Kind;
  cadence?: string;
  campaign?: string;
  note?: string;
  flag?: string;
}

const DOW: Record<Weekday, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5 };

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
/** Move a weekend date to the nearest business day in direction `dir`. */
function weekday(date: string, dir: 1 | -1): string {
  let d = date;
  while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = addDays(d, dir);
  return d;
}
function nthWeekday(year: number, month: number, weekday: Weekday, nth: number): string {
  if (nth > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const shift = (DOW[weekday] - first.getUTCDay() + 7) % 7;
    return iso(new Date(Date.UTC(year, month - 1, 1 + shift + (nth - 1) * 7)));
  }
  const last = new Date(Date.UTC(year, month, 0));
  const back = (last.getUTCDay() - DOW[weekday] + 7) % 7;
  return iso(new Date(Date.UTC(year, month - 1, last.getUTCDate() - back)));
}

function occurrences(rec: Recurrence): string[] {
  const out: string[] = [];
  if (rec.kind === "weekly") {
    let d = RANGE_START;
    while (new Date(`${d}T00:00:00Z`).getUTCDay() !== DOW[rec.weekday]) d = addDays(d, 1);
    for (; d <= RANGE_END; d = addDays(d, 7)) out.push(d);
    return out;
  }
  const [sy, sm] = RANGE_START.split("-").map(Number);
  const [ey, em] = RANGE_END.split("-").map(Number);
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    if (rec.months && !rec.months.includes(m)) continue;
    out.push(nthWeekday(y, m, rec.weekday, rec.nth));
  }
  return out;
}

function rrule(rec: Recurrence): string {
  if (rec.kind === "weekly") return `FREQ=WEEKLY;BYDAY=${rec.weekday};UNTIL=20271231T235959Z`;
  const byday = `BYDAY=${rec.nth}${rec.weekday}`;
  return rec.months
    ? `FREQ=YEARLY;BYMONTH=${rec.months.join(",")};${byday};UNTIL=20271231T235959Z`
    : `FREQ=MONTHLY;${byday};UNTIL=20271231T235959Z`;
}

const campaignName = (slug?: string) => CAMPAIGNS.find((c) => c.slug === slug)?.offerName;

// ------------------------------------------------------------------ collect
const items: Item[] = [];
const ics: IcsEvent[] = [];

for (const s of SERIES) {
  for (const date of occurrences(s.recurrence)) {
    items.push({ date, time: s.time, title: s.title, audience: s.audience, kind: "series", cadence: s.cadence });
  }
  ics.push({
    uid: `series-${s.id}@digeratiexperts.com`,
    summary: `[${s.audience}] ${s.title}`,
    description: [s.purpose, `Owner: ${s.owner}`, `Prep: ${s.prep.join("; ")}`, s.source ? `Start from: ${s.source}` : ""]
      .filter(Boolean)
      .join("\n"),
    start: `${occurrences(s.recurrence)[0]}T${s.time}`,
    durationMinutes: s.durationMinutes,
    rrule: rrule(s.recurrence),
    categories: [s.audience, s.cadence],
  });
}

for (const session of DE_EVENT_SESSIONS) {
  const date = session.start.slice(0, 10);
  const time = session.start.slice(11, 16);
  const url = `${SITE}/events/${session.slug}`;
  items.push({
    date,
    time,
    title: session.title,
    audience: session.audience,
    kind: "session",
    campaign: session.campaign,
    note: `${session.format}, ${session.durationMinutes} min. Page: /events/${session.slug}`,
    flag: session.status,
  });
  ics.push({
    uid: `session-${session.slug}@digeratiexperts.com`,
    summary: `[${session.audience}] ${session.format}: ${session.title}`,
    description: `${session.summary}\nCampaign: /go/${session.campaign}\nStatus: ${session.status}`,
    start: `${date}T${time}`,
    durationMinutes: session.durationMinutes,
    url,
    categories: ["session", session.audience],
  });
  for (const step of SESSION_PREP) {
    const prepDate = weekday(addDays(date, step.offsetDays), step.offsetDays < 0 ? -1 : 1);
    const label = step.offsetDays < 0 ? `T${step.offsetDays}d` : `T+${step.offsetDays}d`;
    const overdue = prepDate < iso(STAMP) ? "overdue at build" : undefined;
    items.push({
      date: prepDate,
      title: `Prep ${label}: ${session.title.split(":")[0]}`,
      audience: "internal",
      kind: "prep",
      note: step.task,
      flag: overdue,
    });
    ics.push({
      uid: `prep-${session.slug}-${step.offsetDays}@digeratiexperts.com`,
      summary: `[prep ${label}] ${session.title.split(":")[0]}`,
      description: step.task,
      start: prepDate,
      allDay: true,
      categories: ["prep"],
    });
  }
}

for (const d of DATED) {
  const date = d.date.slice(0, 10);
  const time = d.date.length > 10 ? d.date.slice(11, 16) : undefined;
  items.push({
    date,
    time,
    days: d.days,
    title: d.title,
    audience: d.audience,
    kind: "dated",
    campaign: d.campaign,
    note: [d.note, d.source ? `Start from: ${d.source}` : ""].filter(Boolean).join(" "),
    flag: d.confirmDates ? "confirm dates" : d.proposedSession ? "proposed" : undefined,
  });
  ics.push({
    uid: `dated-${d.id}@digeratiexperts.com`,
    summary: `[${d.audience}] ${d.title}`,
    description: [d.note, d.campaign ? `Campaign: /go/${d.campaign}` : "", `Owner: ${d.owner}`, d.source ? `Start from: ${d.source}` : ""]
      .filter(Boolean)
      .join("\n"),
    start: time ? `${date}T${time}` : date,
    allDay: !time,
    days: d.days,
    durationMinutes: d.durationMinutes,
    categories: [d.audience],
  });
}

items.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

const months: string[] = [];
for (let m = RANGE_START.slice(0, 7); m <= RANGE_END.slice(0, 7); ) {
  months.push(m);
  const [y, mm] = m.split("-").map(Number);
  m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
}
const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const to12h = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Campaign of the month = the campaign carried by most of its sessions/seasons. */
function monthCampaigns(m: string): string[] {
  const set = new Set<string>();
  for (const it of items) if (it.date.startsWith(m) && it.campaign && it.kind !== "prep") set.add(it.campaign);
  return [...set];
}

// ------------------------------------------------------------------ markdown
const AUD: Record<Who, string> = {
  prospects: "Prospects",
  clients: "Clients",
  internal: "Internal",
  "prospects-and-clients": "Prospects + clients",
};

function md(): string {
  const out: string[] = [];
  out.push(
    "# DE Event & Campaign Calendar — Oct 2026 to Dec 2027",
    "",
    "> Generated by `npx tsx scripts/de-events/build.ts` from `scripts/de-events/program.ts` and `client/src/data/deEvents.ts`. Edit those, not this file.",
    "> **Status: PROPOSED.** Nothing here is confirmed until Joe signs off at quarterly planning. All times America/Phoenix (no daylight saving).",
    "> Import `de-event-calendar.ics` into Zoho Calendar (Settings → Import) as a separate \"DE Events\" calendar so it can be shown or hidden as one layer.",
    "",
    "## How the year is built",
    "",
    "- **Prospects** get one live session most months, each feeding one `/go/:slug` campaign page, plus a monthly newsletter and a weekly publish block.",
    "- **Clients** get a monthly newsletter, Patch Tuesday advisories, monthly office hours, quarterly restore tests and QBR seasons, and an annual survey, license audit and budget conversation.",
    "- **Internal** runs a weekly huddle, pipeline review and week wrap; a monthly all-hands, lunch & learn and close; quarterly planning and tabletop exercises; and annual kickoff, training, reviews and policy review.",
    "- Every live session carries a five-week prep track (T-35 to T+2). Prep steps already past at build time are flagged **overdue at build**; steps before October 2026 are not listed.",
    "",
    "## Weekly, monthly and quarterly rhythm",
    "",
    "| Cadence | When (Phoenix) | Event | Audience | Owner | Start from |",
    "|---|---|---|---|---|---|",
  );
  const when = (r: Recurrence) =>
    r.kind === "weekly"
      ? `Every ${["", "Mon", "Tue", "Wed", "Thu", "Fri"][DOW[r.weekday]]}`
      : `${r.nth === -1 ? "Last" : ["", "1st", "2nd", "3rd", "4th"][r.nth]} ${["", "Mon", "Tue", "Wed", "Thu", "Fri"][DOW[r.weekday]]}${
          r.months ? ` of ${r.months.map((m) => new Date(Date.UTC(2027, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" })).join("/")}` : ""
        }`;
  for (const s of SERIES) {
    out.push(
      `| ${s.cadence} | ${when(s.recurrence)} ${to12h(s.time)} | **${s.title}** — ${s.purpose} | ${AUD[s.audience]} | ${s.owner} | ${s.source ?? "—"} |`,
    );
  }
  out.push("", "## Campaign map", "", "| Month | Campaign pages in play | Live sessions |", "|---|---|---|");
  for (const m of months) {
    const camps = monthCampaigns(m).map((c) => `[${campaignName(c)}](${SITE}/go/${c})`).join(", ") || "—";
    const sessions = items
      .filter((it) => it.date.startsWith(m) && (it.kind === "session" || it.flag === "proposed"))
      .map((it) => `${dayLabel(it.date)}: ${it.title}${it.flag ? ` *(${it.flag})*` : ""}`)
      .join("<br>") || "—";
    out.push(`| ${monthLabel(m)} | ${camps} | ${sessions} |`);
  }
  for (const m of months) {
    out.push("", `## ${monthLabel(m)}`, "");
    const list = items.filter((it) => it.date.startsWith(m) && it.kind !== "series");
    if (!list.length) out.push("_Rhythm only._");
    for (const it of list) {
      const span = it.days && it.days > 1 ? ` → ${dayLabel(addDays(it.date, it.days - 1))}` : "";
      out.push(
        `- **${dayLabel(it.date)}${span}${it.time ? `, ${to12h(it.time)}` : ""}** · ${AUD[it.audience]} · ${it.title}${it.flag ? ` — _${it.flag}_` : ""}${
          it.campaign ? ` · campaign: [${campaignName(it.campaign)}](/go/${it.campaign})` : ""
        }${it.note ? `  \n  ${it.note}` : ""}`,
      );
    }
  }
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------- html
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function html(): string {
  const monthBlocks = months
    .map((m) => {
      const [y, mm] = m.split("-").map(Number);
      const first = new Date(Date.UTC(y, mm - 1, 1));
      const daysIn = new Date(Date.UTC(y, mm, 0)).getUTCDate();
      const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
      const cells: string[] = [];
      for (let i = 0; i < lead; i++) cells.push(`<div class="c empty"></div>`);
      for (let day = 1; day <= daysIn; day++) {
        const date = `${m}-${String(day).padStart(2, "0")}`;
        const dayItems = items.filter((it) => {
          if (it.kind === "series" && it.cadence === "weekly") return false;
          const end = it.days ? addDays(it.date, it.days - 1) : it.date;
          return date >= it.date && date <= end && (it.date === date || day === 1 || new Date(`${date}T00:00:00Z`).getUTCDay() === 1);
        });
        const pills = dayItems
          .map(
            (it) =>
              `<span class="p ${it.kind === "prep" ? "prep" : it.audience}${it.kind === "session" ? " session" : ""}" title="${esc(
                `${it.title}${it.time ? ` · ${to12h(it.time)}` : ""}${it.note ? ` — ${it.note}` : ""}`,
              )}">${esc(it.kind === "session" ? `★ ${it.title.split(":")[0]}` : it.title.split(":")[0])}</span>`,
          )
          .join("");
        cells.push(`<div class="c"><b>${day}</b>${pills}</div>`);
      }
      const camps = monthCampaigns(m)
        .map((c) => `<a href="${SITE}/go/${c}">${esc(campaignName(c) ?? c)}</a>`)
        .join(" · ");
      return `<section class="month"><header><h2>${monthLabel(m)}</h2>${camps ? `<p class="camp">Campaigns: ${camps}</p>` : ""}</header>
<div class="grid">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="h">${d}</div>`).join("")}${cells.join("")}</div></section>`;
    })
    .join("\n");

  const weekly = SERIES.filter((s) => s.cadence === "weekly")
    .map((s) => `<li><b>${["", "Mon", "Tue", "Wed", "Thu", "Fri"][DOW[(s.recurrence as { weekday: Weekday }).weekday]]} ${to12h(s.time)}</b> ${esc(s.title)} <i>${AUD[s.audience]}</i></li>`)
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DE Event Calendar</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Oxanium:wght@500;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#050312;--raised:#151217;--line:rgba(255,255,255,.1);--ink:#fff;--muted:#a1a1aa;--pop:#D3126A;--violet:#8B5CF6;--client:#38bdf8;--internal:#a1a1aa;--prep:#52525b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Inter,system-ui,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:32px 16px 64px}
h1{font:700 clamp(28px,4vw,44px)/1.05 "Space Grotesk",sans-serif;letter-spacing:-.03em;margin:0}
h1 span{color:var(--pop)}h2{font:600 22px "Space Grotesk",sans-serif;margin:0}
.lede{color:var(--muted);max-width:70ch}.status{font:500 12px Oxanium,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--pop)}
.legend{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0;font-size:12px}.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.weekly{background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:16px 20px;margin:20px 0}
.weekly ul{margin:8px 0 0;padding-left:18px}.weekly i{color:var(--muted);font-style:normal;font-size:12px}
.month{background:var(--raised);border:1px solid var(--line);border-radius:20px;padding:20px;margin:20px 0}
.month header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:12px}
.camp{margin:0;color:var(--muted);font-size:13px}.camp a{color:#fff;text-decoration-color:var(--pop)}
.grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.h{font:500 11px Oxanium,monospace;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;padding:4px}
.c{min-height:84px;border:1px solid var(--line);border-radius:8px;padding:4px;display:flex;flex-direction:column;gap:3px;min-width:0}
.c.empty{border-color:transparent}.c b{font:500 12px Oxanium,monospace;color:var(--muted)}
.p{display:block;font-size:11px;line-height:1.25;padding:2px 5px;border-radius:4px;border-left:3px solid;background:rgba(255,255,255,.04);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:help}
.prospects,.prospects-and-clients{border-color:var(--pop)}.clients{border-color:var(--client)}.internal{border-color:var(--internal)}.prep{border-color:var(--prep);color:var(--muted)}
.session{background:rgba(211,18,106,.18);font-weight:600}
@media (max-width:720px){.grid{grid-template-columns:1fr}.h,.c.empty{display:none}.c{min-height:0}.c:not(:has(.p)){display:none}.p{white-space:normal}}
</style></head><body><div class="wrap">
<p class="status">Proposed · Oct 2026 – Dec 2027 · America/Phoenix</p>
<h1>DE event <span>&amp;</span> campaign calendar</h1>
<p class="lede">Every event Digerati Experts schedules and preps for: live sessions for prospects, the client rhythm, and the internal operating cadence. Each month names the campaign pages it feeds. Hover any entry for details. Generated from <code>scripts/de-events/program.ts</code>; import <code>de-event-calendar.ics</code> into Zoho Calendar.</p>
<div class="legend"><span><i style="background:var(--pop)"></i>Prospects / public</span><span><i style="background:var(--client)"></i>Clients</span><span><i style="background:var(--internal)"></i>Internal</span><span><i style="background:var(--prep)"></i>Session prep</span><span>★ Live session</span></div>
<div class="weekly"><h2>Every week</h2><ul>${weekly}</ul></div>
${monthBlocks}
</div></body></html>
`;
}

// --------------------------------------------------------------------- write
const outputs: Record<string, string> = {
  "DE-EVENT-CALENDAR.md": md(),
  "de-event-calendar.ics": buildIcs(ics, { calendarName: "DE Events", stamp: STAMP }),
  "de-event-calendar.html": html(),
};

const check = process.argv.includes("--check");
let stale = 0;
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  const path = resolve(OUT, name);
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current === content) continue;
  if (check) {
    console.error(`stale: docs/marketing/${name}`);
    stale += 1;
  } else {
    writeFileSync(path, content);
    console.log(`wrote docs/marketing/${name}`);
  }
}
if (check && stale) {
  console.error("Run: npx tsx scripts/de-events/build.ts");
  process.exit(1);
}
console.log(`${items.length} calendar entries, ${ics.length} ics events`);
