#!/usr/bin/env node
/*
 * kie.ai budget gate: projects what a job will cost, enforces soft and hard
 * limits per job and per month, and keeps a ledger of what was really spent.
 * No dependencies. Every kie.ai generator in this repo calls `gate` before a
 * createTask and `record` after it (nano-banana-images, excalidraw-visuals,
 * scrollcraft).
 *
 *   node .claude/kie-budget/budget.mjs status
 *   node .claude/kie-budget/budget.mjs estimate --model nano-banana-2 --count 6 [--resolution 2K] [--seconds 8]
 *   node .claude/kie-budget/budget.mjs open  --job <name> --model <id> --count <n> [--resolution 2K] [--seconds s] [--soft-ok "<Joe, date>"] [--note "..."]
 *   node .claude/kie-budget/budget.mjs gate  --job <name> --model <id> [--resolution 2K] [--seconds s]
 *   node .claude/kie-budget/budget.mjs record --job <name> --model <id> --credits <n> [--task <id>] [--file <path>]
 *   node .claude/kie-budget/budget.mjs close --job <name>
 *
 * Exit codes: 0 ok, 2 refused by a limit (nothing should be sent), 1 usage or error.
 */
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const LIMITS = path.join(here, "limits.json");
const LEDGER = process.env.KIE_BUDGET_LEDGER || path.join(here, "ledger.jsonl");

const cfg = JSON.parse(fs.readFileSync(LIMITS, "utf8"));
const usd = (credits) => Math.round(credits * cfg.usdPerCredit * 10000) / 10000;
const money = (n) => `$${n.toFixed(2)}`;

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[a.slice(2)] = true;
      else { out[a.slice(2)] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function readLedger() {
  if (!fs.existsSync(LEDGER)) return [];
  return fs.readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
function append(entry) {
  fs.appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

/** Credits for one unit (an image, or a clip of `seconds`). */
function unitCredits(modelId, resolution, seconds) {
  const m = cfg.models[modelId];
  if (!m) throw new Error(`no price for model "${modelId}" in limits.json; add it before spending`);
  if (m.creditsPerSecond != null) {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s <= 0) throw new Error(`${modelId} is priced per second: pass --seconds`);
    return m.creditsPerSecond * s;
  }
  const c = m.credits[resolution] ?? m.credits.default ?? m.credits["1K"];
  if (c == null) throw new Error(`no price for ${modelId} at ${resolution}`);
  return c;
}

const monthKey = (iso) => iso.slice(0, 7);
function monthSpent(ledger, now = new Date().toISOString()) {
  return ledger.filter((e) => e.type === "spend" && monthKey(e.at) === monthKey(now)).reduce((s, e) => s + e.usd, 0);
}
function jobState(ledger, job) {
  const opened = ledger.filter((e) => e.type === "open" && e.job === job).at(-1);
  if (!opened) return null;
  const closed = ledger.some((e) => e.type === "close" && e.job === job && e.at >= opened.at);
  const spent = ledger.filter((e) => e.type === "spend" && e.job === job && e.at >= opened.at).reduce((s, e) => s + e.usd, 0);
  return { opened, closed, spent };
}

async function balance() {
  const key = process.env.KIE_AI_API_KEY || process.env.KIE_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.kie.ai/api/v1/chat/credit", { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json();
    return j.code === 200 ? Number(j.data) : null;
  } catch {
    return null;
  }
}

function refuse(msg) {
  console.error(`REFUSED (nothing should be sent): ${msg}`);
  process.exit(2);
}

const [cmd, ...rest] = process.argv.slice(2);
const a = args(rest);
const L = cfg.limits;

try {
  if (cmd === "status") {
    const ledger = readLedger();
    const bal = await balance();
    const m = monthSpent(ledger);
    const open = [...new Set(ledger.filter((e) => e.type === "open").map((e) => e.job))]
      .map((job) => ({ job, ...jobState(ledger, job) }))
      .filter((j) => !j.closed);
    console.log(`Balance:        ${bal == null ? "unknown (no key or unreachable)" : `${bal} credits (${money(usd(bal))})`}`);
    console.log(`This month:     ${money(m)} spent · soft ${money(L.month.soft)} · hard ${money(L.month.hard)}`);
    console.log(`Per job:        soft ${money(L.job.soft)} · hard ${money(L.job.hard)}`);
    for (const j of open) console.log(`Open job:       ${j.job} · projected ${money(j.opened.projectedUsd)} · spent ${money(j.spent)}${j.opened.softOk ? ` · soft limit waived by ${j.opened.softOk}` : ""}`);
    process.exit(0);
  }

  if (cmd === "estimate" || cmd === "open") {
    const model = a.model, count = Number(a.count ?? 1), res = a.resolution || "1K";
    if (!model) throw new Error("--model is required");
    const per = unitCredits(model, res, a.seconds);
    const credits = per * count, cost = usd(credits);
    const ledger = readLedger();
    const m = monthSpent(ledger);
    const lines = [
      `Projection: ${count} × ${model}${a.seconds ? ` ${a.seconds}s` : ` @ ${res}`} = ${credits} credits ≈ ${money(cost)}`,
      `Job limits:   soft ${money(L.job.soft)} · hard ${money(L.job.hard)}`,
      `Month:        ${money(m)} spent + ${money(cost)} = ${money(m + cost)} · soft ${money(L.month.soft)} · hard ${money(L.month.hard)}`,
    ];
    const bal = await balance();
    if (bal != null) lines.push(`Balance:      ${bal} credits (${money(usd(bal))})${bal < credits ? "  ← NOT ENOUGH: top up on kie.ai first" : ""}`);
    console.log(lines.join("\n"));
    const overHard = cost > L.job.hard ? "the job hard limit" : m + cost > L.month.hard ? "the month hard limit" : null;
    const overSoft = cost > L.job.soft ? "the job soft limit" : m + cost > L.month.soft ? "the month soft limit" : null;
    if (cmd === "estimate") {
      console.log(overHard ? `Verdict: over ${overHard}. Raise it in limits.json or shrink the job.` : overSoft ? `Verdict: over ${overSoft}. Needs --soft-ok "<Joe, date>" to open.` : "Verdict: within limits.");
      process.exit(0);
    }
    if (!a.job) throw new Error("--job <name> is required");
    if (overHard) refuse(`projection ${money(cost)} is over ${overHard}. Raise it in limits.json or shrink the job.`);
    if (overSoft && !a["soft-ok"]) refuse(`projection ${money(cost)} is over ${overSoft}. Re-run with --soft-ok "<Joe, date>" once Joe approves.`);
    const st = jobState(ledger, a.job);
    if (st && !st.closed) throw new Error(`job "${a.job}" is already open (spent ${money(st.spent)}); close it first or use another name`);
    append({ type: "open", job: a.job, model, count, resolution: res, seconds: a.seconds ? Number(a.seconds) : undefined, projectedCredits: credits, projectedUsd: cost, softOk: a["soft-ok"] || undefined, note: a.note || undefined });
    console.log(`Opened job "${a.job}".`);
    process.exit(0);
  }

  if (cmd === "gate") {
    if (!a.job) refuse("no job: open one with `budget.mjs open --job <name> ...` and pass it (KIE_JOB) to the generator");
    const ledger = readLedger();
    const st = jobState(ledger, a.job);
    if (!st) refuse(`job "${a.job}" was never opened`);
    if (st.closed) refuse(`job "${a.job}" is closed`);
    const model = a.model || st.opened.model;
    const cost = usd(unitCredits(model, a.resolution || st.opened.resolution || "1K", a.seconds ?? st.opened.seconds));
    const after = st.spent + cost, m = monthSpent(ledger) + cost;
    if (after > L.job.hard) refuse(`this call takes job "${a.job}" to ${money(after)}, over the job hard limit ${money(L.job.hard)}`);
    if (m > L.month.hard) refuse(`this call takes the month to ${money(m)}, over the month hard limit ${money(L.month.hard)}`);
    if ((after > L.job.soft || m > L.month.soft) && !st.opened.softOk) refuse(`this call crosses a soft limit (job ${money(after)} / ${money(L.job.soft)}, month ${money(m)} / ${money(L.month.soft)}); reopen the job with --soft-ok once Joe approves`);
    const allowance = st.opened.projectedUsd * 1.25;
    if (after > allowance + 1e-9) refuse(`job "${a.job}" would reach ${money(after)}, more than 125% of its projection ${money(st.opened.projectedUsd)}; open a new job with a new projection`);
    const bal = await balance();
    if (bal != null && usd(bal) < cost) refuse(`balance ${bal} credits cannot cover ${money(cost)}; top up on kie.ai`);
    console.log(`OK: ${model} ≈ ${money(cost)} · job ${money(after)} of projected ${money(st.opened.projectedUsd)} · month ${money(m)}`);
    process.exit(0);
  }

  if (cmd === "record") {
    if (!a.job || !a.model || a.credits === undefined) throw new Error("record needs --job, --model and --credits");
    const credits = Number(a.credits);
    append({ type: "spend", job: a.job, model: a.model, credits, usd: usd(credits), task: a.task || undefined, file: a.file || undefined });
    console.log(`Recorded ${credits} credits (${money(usd(credits))}) on job "${a.job}".`);
    process.exit(0);
  }

  if (cmd === "close") {
    if (!a.job) throw new Error("--job is required");
    const st = jobState(readLedger(), a.job);
    append({ type: "close", job: a.job, spentUsd: st ? st.spent : 0 });
    console.log(`Closed job "${a.job}" at ${money(st ? st.spent : 0)}${st ? ` (projected ${money(st.opened.projectedUsd)})` : ""}.`);
    process.exit(0);
  }

  console.log("usage: budget.mjs status | estimate | open | gate | record | close   (see the header of this file)");
  process.exit(1);
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
}
