/**
 * Session marketing kit renderer: one YAML source per live session
 * (docs/marketing/sessions/<slug>.yaml) becomes everything DE sends for it.
 *
 *   <slug>.md                        the session kit (step 0, track, run of show, calls)
 *   out/<slug>/emails/<id>.html      branded email, table layout, inline styles
 *   out/<slug>/emails/<id>.txt       plain-text alternative (paste into any sender)
 *   out/<slug>/linkedin/<n>.txt      posts, with the page link resolved
 *   out/<slug>/cards/*.png           social cards (written by cards.ts, not here)
 *   preview.html                     every kit on one page, with copy buttons
 *
 * FACTS come from client/src/data/deEvents.ts, never from the YAML: copy says
 * {date_long} or {page}, and the date, time, presenter and URL are filled from
 * the session record. Change the session there and every piece follows.
 *
 * TRUTH (Tier 0, docs/CLAIMS-REGISTER.md): lint() rejects statistics,
 * guarantees and superlatives, and a join link anywhere but the T-1 email.
 * Voice rules: docs/marketing/VOICE.md.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { DE_EVENT_SESSIONS, DE_EVENT_TIME_ZONE, sessionEnd, sessionStart, type DeEventSession } from "../../client/src/data/deEvents";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SRC_DIR = resolve(ROOT, "docs/marketing/sessions");
export const SITE = "https://digeratiexperts.com";

export interface EmailSrc {
  id: string;
  to: string;
  send: string;
  subject: string;
  preview?: string;
  /** "email" (greeting and sign-off added) or "newsletter-block" (neither). */
  kind?: "email" | "newsletter-block";
  heading?: string;
  body: string;
  cta?: string;
  cta_url?: string;
  resend?: string;
}
export interface PostSrc {
  send: string;
  text: string;
}
export interface CardSrc {
  id: string;
  kicker: string;
  headline: string;
  quip: string;
}
export interface KitSrc {
  slug: string;
  status: string;
  decided: string[];
  open: { item: string; by: string; notes: string }[];
  track: { date: string; step: string; owner: string }[];
  registrations: string;
  emails: EmailSrc[];
  linkedin: PostSrc[];
  cards: CardSrc[];
  run_of_show: { time: string; min: string; segment: string; notes: string }[];
  calls: { when: string; who: string; script: string };
  slides?: string;
}

export interface Kit {
  src: KitSrc;
  session: DeEventSession;
  tokens: Record<string, string>;
}

/* ------------------------------------------------------------------ dates */

const clean = (s: string) => s.replace(/[  ]/g, " ");

function part(d: Date, tz: string, opt: Intl.DateTimeFormatOptions): string {
  return clean(new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opt }).format(d));
}
export function timeIn(d: Date, tz: string): string {
  return part(d, tz, { hour: "numeric", minute: "2-digit", hour12: true });
}
/** "Thursday 5 November" — built from parts so ICU ordering never shifts it. */
export function dateLong(d: Date, tz = DE_EVENT_TIME_ZONE): string {
  return `${part(d, tz, { weekday: "long" })} ${part(d, tz, { day: "numeric" })} ${part(d, tz, { month: "long" })}`;
}
export function dateShort(d: Date, tz = DE_EVENT_TIME_ZONE): string {
  return `${part(d, tz, { weekday: "short" })} ${part(d, tz, { day: "numeric" })} ${part(d, tz, { month: "short" })}`;
}
/** "Thu 22 Oct" for a plain YYYY-MM-DD planning date. */
export function planDate(ymd: string): string {
  return dateShort(new Date(`${ymd}T12:00:00Z`), "UTC");
}

const OTHER_ZONES: [string, string][] = [
  ["America/Los_Angeles", "Pacific"],
  ["America/Denver", "Mountain"],
  ["America/Chicago", "Central"],
  ["America/New_York", "Eastern"],
];

/* ----------------------------------------------------------------- tokens */

export function tokensFor(session: DeEventSession): Record<string, string> {
  const start = sessionStart(session);
  const end = sessionEnd(session);
  return {
    title: session.title,
    date_long: dateLong(start),
    date_short: dateShort(start),
    time: timeIn(start, DE_EVENT_TIME_ZONE),
    end_time: timeIn(end, DE_EVENT_TIME_ZONE),
    tz: "Arizona time",
    minutes: String(session.durationMinutes),
    presenter: session.presenter ?? "[Presenter]",
    platform: session.platform ?? "[Platform]",
    page: `${SITE}/events/${session.slug}`,
    campaign: `${SITE}/go/${session.campaign}`,
    agenda: session.agenda.map((a) => a.title).join(" · "),
    // Computed, so November's end of daylight saving is never guessed.
    other_zones: OTHER_ZONES.map(([tz, name]) => `${timeIn(start, tz)} ${name}`).join(" / "),
  };
}

export function fill(text: string, tokens: Record<string, string>, where: string): string {
  return text.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    if (!(key in tokens)) throw new Error(`${where}: unknown token {${key}}`);
    return tokens[key];
  });
}

/* ----------------------------------------------------------------- source */

export function loadKits(dir = SRC_DIR): Kit[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => {
      const src = parse(readFileSync(resolve(dir, f), "utf8")) as KitSrc;
      const session = DE_EVENT_SESSIONS.find((s) => s.slug === src.slug);
      if (!session) throw new Error(`${f}: no session with slug ${src.slug} in deEvents.ts`);
      return { src, session, tokens: tokensFor(session) };
    });
}

/* ------------------------------------------------------------------- lint */

const BANNED: [RegExp, string][] = [
  [/\d+(\.\d+)?\s?(%|percent\b)/i, "a percentage (statistics need a CLAIMS-REGISTER source)"],
  [/\b\d+\s+(in|out of)\s+\d+\b/i, "an 'N in M' statistic"],
  [/\b(best|leading|#1|number one|world-class|military-grade|bulletproof|unhackable|hack-proof)\b/i, "a superlative or absolute"],
  [/\bmost\s+(businesses|companies|attacks|breaches|effective|common)\b/i, "an unsourced 'most …' claim"],
  [/\b(stops?|blocks?|prevents?)\s+(all|every)\b/i, "a prevention promise"],
  [/\bnever\s+(get|be)\s+(hacked|breached|phished)\b/i, "a prevention promise"],
];

export function lint(kit: Kit): string[] {
  const out: string[] = [];
  const check = (text: string, where: string, allowJoin = false) => {
    for (const [re, why] of BANNED) if (re.test(text)) out.push(`${where}: ${why}: "${text.match(re)?.[0]}"`);
    // "guarantee" only allowed when negated ("cannot guarantee", "no guarantee").
    for (const m of text.matchAll(/\bguarantee[sd]?\b/gi)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 16), m.index).toLowerCase();
      if (!/(not|n't|no|never)\s+$/.test(before)) out.push(`${where}: an un-negated "guarantee"`);
    }
    if (!allowJoin && /\[JOIN LINK\]|zoho\.com\/(meeting|webinar)|zoom\.us\/j\//i.test(text))
      out.push(`${where}: a join link outside the T-1 email`);
  };
  const { src, session } = kit;
  const day = session.start.slice(0, 10);
  for (const e of src.emails) {
    const where = `${src.slug} email ${e.id}`;
    const isT1 = e.send === prevDay(day);
    check([e.subject, e.preview ?? "", e.heading ?? "", e.body].join("\n"), where, isT1);
    if (e.subject.length > 78) out.push(`${where}: subject over 78 characters`);
    if ((e.preview ?? "").length > 110) out.push(`${where}: preview over 110 characters`);
  }
  src.linkedin.forEach((p, i) => {
    check(p.text, `${src.slug} linkedin ${i + 1}`);
    if (fill(p.text, kit.tokens, "").length > 3000) out.push(`${src.slug} linkedin ${i + 1}: over LinkedIn's 3,000 characters`);
  });
  for (const c of src.cards) check(`${c.kicker}\n${c.headline}\n${c.quip}`, `${src.slug} card ${c.id}`);
  check(src.calls.script, `${src.slug} call script`);
  for (const t of src.track) if (t.date > day && t.date > addDays(day, 7)) out.push(`${src.slug} track ${t.date}: more than a week after the session`);
  return out;
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function prevDay(ymd: string): string {
  return addDays(ymd, -1);
}

/* --------------------------------------------------------- markdown-lite */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

/** Paragraphs separated by blank lines; "- " lines are bullets; **bold**, *italic*. */
export function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.trim().split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => l.startsWith("- "))) out.push({ kind: "ul", items: lines.map((l) => l.slice(2)) });
    else out.push({ kind: "p", text: lines.join(" ") });
  }
  return out;
}
function inlineHtml(s: string, linkColor: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/(https:\/\/[^\s<]+[^\s<.,;:)])/g, `<a href="$1" style="color:${linkColor};text-decoration:underline">$1</a>`);
}
const inlineText = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");

/* ----------------------------------------------------------------- emails */

const MAGENTA = "#D3126A";
const PAPER_INK = "#A30E52";
const NIGHT = "#050312";
const SIGN_OFF = ["[Sender name]", "Digerati Experts · Chandler, Arizona"];

export function emailText(kit: Kit, e: EmailSrc): string {
  const t = kit.tokens;
  const where = `${kit.src.slug} email ${e.id}`;
  const body = blocks(fill(e.body, t, where))
    .map((b) => (b.kind === "p" ? inlineText(b.text) : b.items.map((i) => `- ${inlineText(i)}`).join("\n")))
    .join("\n\n");
  const lines: string[] = [`Subject: ${fill(e.subject, t, where)}`];
  if (e.preview) lines.push(`Preview: ${fill(e.preview, t, where)}`);
  lines.push("");
  if (e.kind === "newsletter-block") {
    if (e.heading) lines.push(fill(e.heading, t, where), "");
    lines.push(body);
    if (e.cta) lines.push("", `${e.cta}: ${fill(e.cta_url ?? "{page}", t, where)}`);
  } else {
    lines.push("Hi [First name],", "", body);
    if (e.cta) lines.push("", `${e.cta}: ${fill(e.cta_url ?? "{page}", t, where)}`);
    lines.push("", ...SIGN_OFF);
  }
  return `${lines.join("\n")}\n`;
}

export function emailHtml(kit: Kit, e: EmailSrc): string {
  const t = kit.tokens;
  const where = `${kit.src.slug} email ${e.id}`;
  const start = sessionStart(kit.session);
  const day = part(start, DE_EVENT_TIME_ZONE, { day: "numeric" });
  const mon = part(start, DE_EVENT_TIME_ZONE, { month: "short" }).toUpperCase();
  const font = "'Space Grotesk',Arial,Helvetica,sans-serif";
  const bodyFont = "Inter,Arial,Helvetica,sans-serif";
  const p = (inner: string) => `<p style="margin:0 0 16px;font:400 16px/1.6 ${bodyFont};color:#1d1a24">${inner}</p>`;
  const bodyHtml = blocks(fill(e.body, t, where))
    .map((b) =>
      b.kind === "p"
        ? p(inlineHtml(b.text, PAPER_INK))
        : `<ul style="margin:0 0 16px;padding:0 0 0 20px">${b.items
            .map((i) => `<li style="margin:0 0 8px;font:400 16px/1.55 ${bodyFont};color:#1d1a24">${inlineHtml(i, PAPER_INK)}</li>`)
            .join("")}</ul>`,
    )
    .join("\n");
  const ctaUrl = fill(e.cta_url ?? "{page}", t, where);
  const cta = e.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td bgcolor="${MAGENTA}" style="border-radius:8px"><a href="${esc(ctaUrl)}" style="display:inline-block;padding:14px 24px;font:600 16px/1 ${font};color:#ffffff;text-decoration:none;border-radius:8px">${esc(e.cta)} &rarr;</a></td></tr></table>`
    : "";
  const greeting = e.kind === "newsletter-block" ? "" : p("Hi [First name],");
  const heading = e.heading ? `<h1 style="margin:0 0 16px;font:700 24px/1.25 ${font};color:#0b0914">${esc(fill(e.heading, t, where))}</h1>` : "";
  const signOff = e.kind === "newsletter-block" ? "" : p(SIGN_OFF.map(esc).join("<br>"));
  const preview = e.preview ? esc(fill(e.preview, t, where)) : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<title>${esc(fill(e.subject, t, where))}</title></head>
<body style="margin:0;padding:0;background:#f3f1f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f1f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td bgcolor="${NIGHT}" style="padding:24px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font:700 13px/1 'Oxanium',${font};letter-spacing:.22em;color:#ffffff">DIGERATI&nbsp;EXPERTS</td>
    <td align="right" style="font:500 11px/1 'Oxanium',${font};letter-spacing:.16em;color:#F04C97">LIVE SESSION</td>
  </tr></table>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>
    <td bgcolor="${MAGENTA}" width="72" align="center" style="padding:10px 0;border-radius:8px 0 0 8px">
      <div style="font:700 28px/1 'Oxanium',${font};color:#ffffff">${day}</div>
      <div style="font:600 11px/1.6 'Oxanium',${font};letter-spacing:.1em;color:#ffffff">${mon}</div>
    </td>
    <td bgcolor="#151217" style="padding:10px 16px;border-radius:0 8px 8px 0">
      <div style="font:600 17px/1.3 ${font};color:#ffffff">${esc(t.time)} – ${esc(t.end_time)}</div>
      <div style="font:400 13px/1.4 ${bodyFont};color:rgba(255,255,255,.78)">${esc(t.date_long)} · ${esc(t.tz)}</div>
    </td>
  </tr></table>
  <div style="margin-top:16px;font:600 20px/1.3 ${font};color:#ffffff">${esc(kit.session.title)}</div>
</td></tr>
<tr><td style="padding:28px 28px 8px">
${heading}${greeting}${bodyHtml}
${cta}${signOff}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #ece8f1;font:400 12px/1.5 ${bodyFont};color:#5f5a68">
  Digerati Experts · Chandler, Arizona · <a href="${SITE}" style="color:${PAPER_INK}">digeratiexperts.com</a><br>[Unsubscribe link: added by the sending tool]
</td></tr>
</table></td></tr></table>
</body></html>
`;
}

/* --------------------------------------------------------------- linkedin */

export function postText(kit: Kit, i: number): string {
  return `${fill(kit.src.linkedin[i].text.trim(), kit.tokens, `${kit.src.slug} linkedin ${i + 1}`)}\n`;
}

/* -------------------------------------------------------------- kit (md) */

const row = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;

export function kitMarkdown(kit: Kit): string {
  const { src, session, tokens: t } = kit;
  const f = (s: string, w: string) => fill(s, t, `${src.slug} ${w}`);
  const out: string[] = [];
  out.push(
    `# Session kit — ${session.title}`,
    "",
    `<!-- GENERATED from ${src.slug}.yaml by scripts/de-marketing/build.ts. Edit the YAML, then run: npx tsx scripts/de-marketing/build.ts -->`,
    "",
    `**${t.date_long} ${session.start.slice(0, 4)}, ${t.time} – ${t.end_time} Arizona (America/Phoenix) · ${session.format}, ${t.minutes} min · Presenter: ${t.presenter} · ${t.platform}**`,
    `Page: ${t.page} · Campaign: ${t.campaign}`,
    `Session data: \`client/src/data/deEvents.ts\` · Copy source: \`docs/marketing/sessions/${src.slug}.yaml\` · Voice: \`docs/marketing/VOICE.md\` · Preview: \`docs/marketing/sessions/preview.html\``,
  );
  if (src.slides) out.push(`Slides: ${src.slides}`);
  out.push("", `> ${f(src.status, "status").trim().replace(/\n/g, "\n> ")}`, "", "## 0. Decided and still open", "");
  for (const d of src.decided) out.push(`- ${f(d, "decided")}`);
  out.push("", row(["Still needed", "By", "Notes"]), row(["---", "---", "---"]));
  for (const o of src.open) out.push(row([o.item, o.by, f(o.notes, "open")]));
  out.push("", "## 1. Promotion track", "", row(["Date", "Step", "Owner"]), row(["---", "---", "---"]));
  for (const s of src.track) out.push(row([planDate(s.date), f(s.step, "track"), f(s.owner, "track")]));
  out.push("", f(src.registrations, "registrations").trim(), "", "## 2. Emails", "");
  out.push("Each email is also rendered as branded HTML and plain text under `out/" + src.slug + "/emails/`.", "");
  for (const e of src.emails) {
    const resend = e.resend ? `; resend to non-openers ${planDate(e.resend)}` : "";
    out.push(`### ${e.id} — ${e.to} (${planDate(e.send)}${resend})`, "", "```text", emailText(kit, e).trimEnd(), "```", "");
  }
  out.push("## 3. LinkedIn", "");
  src.linkedin.forEach((p, i) => out.push(`**Post ${i + 1} (${planDate(p.send)})**`, "", "```text", postText(kit, i).trimEnd(), "```", ""));
  out.push("## 4. Social cards", "", "Rendered to `out/" + src.slug + "/cards/` at 1200×627 (LinkedIn) and 1080×1080.", "");
  for (const c of src.cards) out.push(`- **${c.id}:** ${c.kicker} · "${f(c.headline, "card")}" · ${f(c.quip, "card")}`);
  out.push("", `## 5. Run of show (${t.minutes} min)`, "", row(["Time (AZ)", "Min", "Segment", "Notes"]), row(["---", "---", "---", "---"]));
  for (const r of src.run_of_show) out.push(row([r.time, r.min, r.segment, r.notes]));
  out.push("", `## 6. Call list (${src.calls.when})`, "", src.calls.who, "", `> ${f(src.calls.script, "calls").trim()}`, "", "Log every call in Zoho CRM against the contact.", "");
  return out.join("\n");
}

/* ---------------------------------------------------------------- preview */

export function previewHtml(kits: Kit[]): string {
  const sections = kits
    .map((kit) => {
      const { src, session, tokens: t } = kit;
      const cards = src.cards
        .map(
          (c) => `<figure><img src="out/${src.slug}/cards/${c.id}-1200x627.png" alt="${esc(`${c.kicker}: ${fill(c.headline, t, "")}`)}" width="600" height="314" loading="lazy">
<figcaption>${esc(c.id)} · <a href="out/${src.slug}/cards/${c.id}-1200x627.png">1200×627</a> · <a href="out/${src.slug}/cards/${c.id}-1080x1080.png">1080×1080</a></figcaption></figure>`,
        )
        .join("\n");
      const emails = src.emails
        .map((e) => {
          const txt = emailText(kit, e);
          return `<article class="item">
<header><span class="chip">${esc(e.id)}</span> <strong>${esc(e.to)}</strong> <span class="when">${esc(planDate(e.send))}${e.resend ? ` · resend ${esc(planDate(e.resend))}` : ""}</span></header>
<p class="subj">${esc(fill(e.subject, t, ""))}</p>
<iframe title="Email ${esc(e.id)}" loading="lazy" srcdoc="${esc(emailHtml(kit, e))}"></iframe>
<details><summary>Plain text</summary><pre>${esc(txt)}</pre></details>
<div class="actions"><button data-copy="${esc(txt)}">Copy text</button> <button data-copy="${esc(emailHtml(kit, e))}">Copy HTML</button> <a href="out/${src.slug}/emails/${e.id}.html">Open HTML</a></div>
</article>`;
        })
        .join("\n");
      const posts = src.linkedin
        .map((p, i) => {
          const txt = postText(kit, i);
          return `<article class="item"><header><span class="chip">Post ${i + 1}</span> <span class="when">${esc(planDate(p.send))} · ${txt.length} characters</span></header><pre>${esc(txt)}</pre><div class="actions"><button data-copy="${esc(txt)}">Copy post</button></div></article>`;
        })
        .join("\n");
      return `<section id="${src.slug}">
<p class="kicker">${esc(t.date_short)} · ${esc(t.time)} ${esc(t.tz)} · ${esc(t.presenter)}</p>
<h2>${esc(session.title)}</h2>
<p class="meta"><a href="${t.page}">${t.page}</a> · edit <code>docs/marketing/sessions/${src.slug}.yaml</code></p>
<h3>Social cards</h3><div class="cards">${cards}</div>
<h3>Emails</h3>${emails}
<h3>LinkedIn</h3>${posts}
</section>`;
    })
    .join("\n");
  const nav = kits.map((k) => `<a href="#${k.src.slug}">${esc(k.tokens.date_short)}: ${esc(k.session.title.split(":")[0])}</a>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Session Kit Preview</title>
<style>
:root{--bg:#050312;--raised:#151217;--line:rgba(255,255,255,.1);--muted:rgba(255,255,255,.78);--pop:#D3126A;--ink:#F04C97}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#fff;font:15px/1.55 Inter,system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:24px 16px 64px}
h1{font:600 28px/1.2 'Space Grotesk',system-ui,sans-serif;margin:8px 0}h2{font:600 24px/1.25 'Space Grotesk',system-ui,sans-serif;margin:4px 0 6px}
h3{font:500 12px/1 Oxanium,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);margin:28px 0 12px}
.kicker{font:500 12px/1 Oxanium,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin:0}
.lede,.meta{color:var(--muted);max-width:72ch}a{color:var(--ink)}code{font:13px Oxanium,monospace;color:#fff}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 8px}nav a{border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;color:#fff}
section{border-top:1px solid var(--line);padding-top:24px;margin-top:32px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
figure{margin:0}figure img{width:100%;height:auto;border-radius:10px;border:1px solid var(--line);display:block}figcaption{color:var(--muted);font-size:13px;margin-top:6px}
.item{background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 16px}
.item header{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.when{color:var(--muted);font-size:13px}
.chip{background:var(--pop);border-radius:6px;padding:2px 8px;font:600 12px/1.4 Oxanium,monospace}
.subj{font-weight:600;margin:10px 0}
iframe{width:100%;height:560px;border:0;border-radius:10px;background:#f3f1f6}
pre{white-space:pre-wrap;word-break:break-word;background:#0b0914;border:1px solid var(--line);border-radius:8px;padding:12px;font:13px/1.55 ui-monospace,monospace;color:#fff}
details summary{cursor:pointer;color:var(--muted);margin:10px 0 0}
.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
button{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid var(--line);background:#0b0914;color:#fff;font:600 13px Inter,system-ui,sans-serif;cursor:pointer}
button:hover{border-color:var(--pop)}button:focus-visible,a:focus-visible{outline:2px solid #ec4899;outline-offset:2px}
</style></head>
<body><div class="wrap">
<p class="kicker">Digerati Experts · internal · generated</p>
<h1>Session kit preview</h1>
<p class="lede">Every email, post and card for the live sessions, built from one YAML file per session. To change anything, edit the YAML and run <code>npx tsx scripts/de-marketing/build.ts</code> (add <code>--cards</code> to re-render the images). Nothing here is sent; DE sends from its own tools.</p>
<nav>${nav}</nav>
${sections}
</div>
<script>
document.addEventListener("click",function(e){var b=e.target.closest("button[data-copy]");if(!b)return;
navigator.clipboard.writeText(b.getAttribute("data-copy")).then(function(){var o=b.textContent;b.textContent="Copied";setTimeout(function(){b.textContent=o},1200)});});
</script>
</body></html>
`;
}

/* ------------------------------------------------------------------ files */

/** Every text output, keyed by path relative to the repo root. Cards are separate (binary). */
export function renderAll(kits: Kit[] = loadKits()): Map<string, string> {
  const files = new Map<string, string>();
  const rel = "docs/marketing/sessions";
  for (const kit of kits) {
    const slug = kit.src.slug;
    files.set(`${rel}/${slug}.md`, kitMarkdown(kit));
    for (const e of kit.src.emails) {
      files.set(`${rel}/out/${slug}/emails/${e.id}.html`, emailHtml(kit, e));
      files.set(`${rel}/out/${slug}/emails/${e.id}.txt`, emailText(kit, e));
    }
    kit.src.linkedin.forEach((_, i) => files.set(`${rel}/out/${slug}/linkedin/post-${i + 1}.txt`, postText(kit, i)));
  }
  files.set(`${rel}/preview.html`, previewHtml(kits));
  return files;
}
