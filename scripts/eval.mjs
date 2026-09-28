#!/usr/bin/env node
// Eval harness for the MSP AI Kit playbooks. Cases live in ../evals/cases/*.json,
// golden outputs in ../evals/golden/<case-id>.md. Scoring is structural and
// deterministic (no model needed): required OUTPUT headings present, banned
// phrases absent, naming rule respected, secrets and fabrication markers absent,
// and any case-specific "must mention" / "must not mention" strings.
//
//   node .claude/skills/msp-ai-kit/scripts/eval.mjs --list
//   node .claude/skills/msp-ai-kit/scripts/eval.mjs --render [--out <dir>]     # prompt + case as paste-ready files
//   node .claude/skills/msp-ai-kit/scripts/eval.mjs --score-golden             # score the committed golden outputs (CI)
//   node .claude/skills/msp-ai-kit/scripts/eval.mjs --score <dir>              # score <dir>/<case-id>.md outputs from any model
//   node .claude/skills/msp-ai-kit/scripts/eval.mjs --run [--out <dir>] [--only ids]   # call Claude, save outputs, score them
//
// --run uses the official Anthropic SDK (@anthropic-ai/sdk) if it is installed
// (npm i @anthropic-ai/sdk in the repo or set MSP_AI_KIT_NODE_MODULES to a
// node_modules folder that has it) and credentials from the environment or
// `ant auth login`. Model: claude-opus-5 with adaptive thinking and server-side
// refusal fallbacks. Every run spends real tokens; nothing runs without --run.
//
// Case file shape (evals/cases/<id>.json):
//   { "id": "triage-mfa-prompts", "module": "service-desk-triage", "title": "...",
//     "inputs": { "[SUBJECT]": "...", ... },            // fills the bracketed fields
//     "mustMention": ["P2"], "mustNotMention": ["P1 Critical"],
//     "expectHeadings": 8 }                              // optional override of numbered OUTPUT items

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(HERE);
const CASES_DIR = path.join(SKILL_DIR, "evals", "cases");
const GOLDEN_DIR = path.join(SKILL_DIR, "evals", "golden");
const BANNED = ["in today's digital landscape", "as an ai", "i cannot browse", "as a large language model", "makes you compliant", "guaranteed security", "100% secure"];
const SECRET_MARKERS = [/\b(sk|ghp|xox[bpa])-[A-Za-z0-9_\-]{10,}/i, /\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/, /(password|api[_ ]?key|token)\s*[:=]\s*\S{8,}/i];

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--list") a.list = true;
    else if (v === "--render") a.render = true;
    else if (v === "--score-golden") a.scoreGolden = true;
    else if (v === "--score") a.score = argv[++i];
    else if (v === "--run") a.run = true;
    else if (v === "--out") a.out = argv[++i];
    else if (v === "--only") a.only = argv[++i].split(",").map((s) => s.trim());
    else if (v === "--json") a.json = true;
    else if (v === "--model") a.model = argv[++i];
    else if (v === "-h" || v === "--help") a.help = true;
    else { console.error(`unknown option ${v}`); process.exit(2); }
  }
  return a;
}

export function loadCases(dir = CASES_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of ["id", "module", "title", "inputs"]) if (!c[k]) throw new Error(`${f}: missing ${k}`);
    if (c.id !== path.basename(f, ".json")) throw new Error(`${f}: id must match the file name`);
    return c;
  });
}

export function fillPrompt(prompt, inputs) {
  let out = prompt;
  const unfilled = [];
  for (const [field, value] of Object.entries(inputs)) out = out.split(field).join(value);
  const inputsOnly = out.split(/^OUTPUT/m)[0]; // placeholders after OUTPUT belong to the model's answer, not to the inputs
  for (const m of inputsOnly.match(/\[[A-Z][^\]\n]{2,}\]/g) || []) unfilled.push(m);
  return { text: out, unfilled: [...new Set(unfilled)] };
}

export function expectedHeadings(prompt) {
  // numbered items under the first OUTPUT heading, e.g. "1. Summary: ..."; stop at a blank-line-separated new OUTPUT block
  const lines = prompt.split("\n");
  const start = lines.findIndex((l) => /^OUTPUT/.test(l));
  if (start < 0) return [];
  const heads = [];
  for (const l of lines.slice(start + 1)) {
    const m = l.match(/^(\d+)\.\s+([^:(]+)/);
    if (m) heads.push(m[2].trim());
    else if (/^OUTPUT/.test(l)) break;
  }
  return heads;
}

export function scoreOutput(output, { prompt, moduleId, mustMention = [], mustNotMention = [], expectHeadings }) {
  const checks = [];
  const add = (name, pass, detail = "") => checks.push({ name, pass, detail });
  const heads = expectedHeadings(prompt);
  const numbered = (output.match(/^\s*\d+\.\s+/gm) || []).length;
  const want = expectHeadings ?? Math.min(heads.length, 5);
  add("numbered output items", numbered >= want, `${numbered} found, ${want} expected`);
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headHits = heads.filter((h) => new RegExp(esc(h.split(/\s+/)[0]), "i").test(output)).length;
  add("output headings echoed", heads.length === 0 || headHits >= Math.ceil(heads.length * 0.6), `${headHits}/${heads.length}`);
  for (const b of BANNED) add(`no banned phrase: ${b}`, !output.toLowerCase().includes(b));
  add("no 'Digerati' alone", !/\bDigerati\b(?! Experts)/.test(output));
  add("no secret-looking strings", !SECRET_MARKERS.some((re) => re.test(output)));
  add("no invented statistics without source", !/\b\d{2,3}% of (companies|businesses|SMBs|organizations)\b(?![^.]*\(source)/i.test(output));
  for (const s of mustMention) add(`mentions: ${s}`, output.toLowerCase().includes(s.toLowerCase()));
  for (const s of mustNotMention) add(`does not mention: ${s}`, !output.toLowerCase().includes(s.toLowerCase()));
  if (moduleId === "incident-comms") add("no humor markers in incident text", !/\b(lol|haha|😂|kidding)\b/i.test(output));
  if (moduleId === "scripting-bash-powershell") {
    add("strict mode present", /Set-StrictMode|set -Eeuo pipefail|set -euo pipefail/.test(output));
    add("no Read-Host / interactive prompts", !/Read-Host|\bread -p\b/.test(output));
    add("no TLS bypass", !/ServicePointManager\]::ServerCertificateValidationCallback|SkipCertificateCheck|--insecure|-k https/i.test(output));
  }
  const passed = checks.filter((c) => c.pass).length;
  return { passed, total: checks.length, score: checks.length ? passed / checks.length : 0, checks };
}

function moduleMap(built) { return Object.fromEntries(built.selected.map((m) => [m.id, m])); }

async function getAnthropic() {
  const candidates = ["@anthropic-ai/sdk"];
  if (process.env.MSP_AI_KIT_NODE_MODULES) candidates.push(path.join(process.env.MSP_AI_KIT_NODE_MODULES, "@anthropic-ai", "sdk", "index.mjs"));
  for (const c of candidates) { try { const mod = await import(c); return mod.default || mod.Anthropic || mod; } catch { /* next */ } }
  throw new Error("@anthropic-ai/sdk is not installed. Run `npm i @anthropic-ai/sdk` (or set MSP_AI_KIT_NODE_MODULES) before --run.");
}

async function runCase(client, model, system, userText) {
  // Beta endpoint so server-side refusal fallbacks apply; adaptive thinking is the default on this model.
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: userText }],
  });
  if (response.stop_reason === "refusal") {
    const cat = response.stop_details?.category ?? "unknown";
    return { text: `[REFUSED: ${cat}] ${response.stop_details?.explanation ?? ""}`, refused: true, usage: response.usage };
  }
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return { text, refused: false, usage: response.usage, servedBy: response.model };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1).filter((l) => l.startsWith("//")).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return; }
  const built = build({ targets: ["prompt-library"] });
  const mods = moduleMap(built);
  let cases = loadCases();
  if (args.only) cases = cases.filter((c) => args.only.includes(c.id));
  for (const c of cases) if (!mods[c.module]) throw new Error(`${c.id}: unknown module ${c.module}`);

  if (args.list) {
    for (const c of cases) console.log(`${c.id.padEnd(34)} ${c.module.padEnd(30)} ${fs.existsSync(path.join(GOLDEN_DIR, `${c.id}.md`)) ? "golden" : "      "}  ${c.title}`);
    console.log(`${cases.length} case(s); modules without a case: ${built.selected.filter((m) => m.command && !cases.some((c) => c.module === m.id)).map((m) => m.id).join(", ") || "none"}`);
    return;
  }

  const rendered = cases.map((c) => {
    const m = mods[c.module];
    const { text, unfilled } = fillPrompt(m.prompt, c.inputs);
    return { c, m, prompt: text, unfilled };
  });

  if (args.render) {
    const out = path.resolve(args.out || path.join(SKILL_DIR, "..", "..", "..", "artifacts", "msp-ai-kit", "evals", "rendered"));
    fs.mkdirSync(out, { recursive: true });
    for (const r of rendered) fs.writeFileSync(path.join(out, `${r.c.id}.md`), `# ${r.c.title}\n\nModule: ${r.c.module}. Paste everything below the line into the assistant.${r.unfilled.length ? `\nUnfilled fields: ${r.unfilled.join(", ")}` : ""}\n\n---\n\n${r.prompt}\n`);
    console.log(`rendered ${rendered.length} case(s) to ${out}`);
    return;
  }

  const scoreDir = args.scoreGolden ? GOLDEN_DIR : args.score ? path.resolve(args.score) : null;
  const results = [];
  if (args.run) {
    const Anthropic = await getAnthropic();
    const client = new Anthropic();
    const model = args.model || "claude-opus-5";
    const out = path.resolve(args.out || path.join(SKILL_DIR, "..", "..", "..", "artifacts", "msp-ai-kit", "evals", "runs", new Date().toISOString().replace(/[:.]/g, "-")));
    fs.mkdirSync(out, { recursive: true });
    const system = built.files.find((f) => f.name === "prompt-library.md").content.split("\n## ")[0] + "\n\nFollow the playbook the user pastes exactly. Use the OUTPUT headings as given.";
    for (const r of rendered) {
      process.stderr.write(`running ${r.c.id} ... `);
      const res = await runCase(client, model, system, r.prompt);
      fs.writeFileSync(path.join(out, `${r.c.id}.md`), res.text);
      const s = scoreOutput(res.text, { prompt: r.m.prompt, moduleId: r.c.module, mustMention: r.c.mustMention, mustNotMention: r.c.mustNotMention, expectHeadings: r.c.expectHeadings });
      results.push({ id: r.c.id, module: r.c.module, ...s, refused: res.refused, usage: res.usage, servedBy: res.servedBy });
      process.stderr.write(`${s.passed}/${s.total}${res.refused ? " (refused)" : ""}\n`);
    }
    fs.writeFileSync(path.join(out, "scores.json"), JSON.stringify(results, null, 2));
    console.log(`outputs and scores.json in ${out}`);
  } else if (scoreDir) {
    for (const r of rendered) {
      const f = path.join(scoreDir, `${r.c.id}.md`);
      if (!fs.existsSync(f)) { results.push({ id: r.c.id, module: r.c.module, missing: true, passed: 0, total: 1, score: 0, checks: [{ name: "output file present", pass: false, detail: f }] }); continue; }
      const s = scoreOutput(fs.readFileSync(f, "utf8"), { prompt: r.m.prompt, moduleId: r.c.module, mustMention: r.c.mustMention, mustNotMention: r.c.mustNotMention, expectHeadings: r.c.expectHeadings });
      results.push({ id: r.c.id, module: r.c.module, ...s });
    }
  } else { console.error("nothing to do: pass --list, --render, --score-golden, --score <dir> or --run"); process.exit(2); }

  if (args.json) console.log(JSON.stringify(results, null, 2));
  else {
    for (const r of results) {
      console.log(`${r.passed === r.total ? "PASS" : "FAIL"} ${r.id.padEnd(34)} ${r.passed}/${r.total}`);
      for (const c of r.checks.filter((c) => !c.pass)) console.log(`      x ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    }
    const failing = results.filter((r) => r.passed !== r.total).length;
    console.log(`${results.length - failing}/${results.length} cases pass every structural check`);
  }
  const anyMissing = results.some((r) => r.missing);
  if (args.scoreGolden && (anyMissing || results.some((r) => r.passed !== r.total))) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(`eval: ${e.message}`); process.exit(1); });
