#!/usr/bin/env node
// MSP AI Kit builder. Renders the prompt modules in ../modules with the values in
// kit.config.json into copy-paste packs for ChatGPT, Custom GPTs, Claude Projects,
// Claude Code / Codex (CLAUDE.md, AGENTS.md), Cursor and GitHub Copilot.
// Node 18+, no dependencies.
//
//   node .claude/skills/msp-ai-kit/scripts/build.mjs                 # build every enabled target
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --list          # show modules, targets, budgets
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --dry-run       # plan + budgets, write nothing
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --check         # validate config + modules, exit 1 on error
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --verify <dir>  # exit 1 if <dir> differs from a fresh build
//
// Options
//   --config <file>        control file (default: kit.config.json next to this skill)
//   --out <dir>            output directory (default: <output_dir>/<profile> from the config)
//   --only a,b             build only these module ids (plus profile and guardrails)
//   --skip a,b             leave these module ids out
//   --targets a,b          build only these targets
//   --set key.path=value   override any config value (JSON or string), repeatable
//   --json                 machine-readable summary on stdout
//   --quiet                errors only
//
// Module file format (modules/NN-id.md): YAML-ish frontmatter (id, title, area,
// priority, command) then sections "## About", "## Line", "## Rules", "## Prompt",
// "## Notes". Templates use {{path}}, {{join path}}, {{#path}}...{{/path}} (repeat for
// arrays, once for truthy values, {{sep}} = ", " between items), {{join path "; "}}
// for a custom separator, {{^path}}...{{/path}}
// (render when empty or false) and {{.}} for the current array item.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const BUILDER_VERSION = "1.0.0";
const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODULES_DIR = path.join(SKILL_DIR, "modules");
const CORE_MODULES = ["profile", "guardrails"];
const TARGET_IDS = [
  "chatgpt-custom-instructions",
  "custom-gpt-instructions",
  "claude-project-instructions",
  "agent-instructions",
  "cursor-rule",
  "copilot-instructions",
  "prompt-library",
  "prompt-files",
];

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const a = { sets: [], list: false, dryRun: false, check: false, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${v} needs a value`);
      return argv[++i];
    };
    switch (v) {
      case "--config": a.config = next(); break;
      case "--out": a.out = next(); break;
      case "--only": a.only = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--skip": a.skip = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--targets": a.targets = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--set": a.sets.push(next()); break;
      case "--verify": a.verify = next(); break;
      case "--list": a.list = true; break;
      case "--dry-run": a.dryRun = true; break;
      case "--check": a.check = true; break;
      case "--json": a.json = true; break;
      case "--quiet": a.quiet = true; break;
      case "-h": case "--help": a.help = true; break;
      default: throw new Error(`unknown option ${v} (try --help)`);
    }
  }
  return a;
}

function usage() {
  const src = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  const lines = src.split("\n").slice(1);
  const out = [];
  for (const l of lines) { if (!l.startsWith("//")) break; out.push(l.replace(/^\/\/ ?/, "")); }
  return out.join("\n");
}

// ------------------------------------------------------------------- config
function stripComments(v) {
  if (Array.isArray(v)) return v.map(stripComments);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("_")) o[k] = stripComments(x);
    return o;
  }
  return v;
}

export function loadConfig(file) {
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch (e) { throw new Error(`cannot read config ${file}: ${e.message}`); }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { throw new Error(`${file} is not valid JSON: ${e.message}`); }
  return stripComments(parsed);
}

export function applySet(config, expr) {
  const eq = expr.indexOf("=");
  if (eq <= 0) throw new Error(`--set expects key.path=value, got "${expr}"`);
  const keyPath = expr.slice(0, eq).split(".").filter(Boolean);
  const rawVal = expr.slice(eq + 1);
  let value = rawVal;
  try { value = JSON.parse(rawVal); } catch { /* keep the string */ }
  let cur = config;
  for (let i = 0; i < keyPath.length - 1; i++) {
    const k = keyPath[i];
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[keyPath[keyPath.length - 1]] = value;
  return config;
}

function validateConfig(c) {
  const errors = [];
  const need = (p) => { if (getPath(c, p) === undefined || getPath(c, p) === "") errors.push(`config: missing ${p}`); };
  ["profile", "company.name", "company.short", "naming.full", "naming.short", "naming.never", "team.business_hours", "stack.psa_ticketing", "sla.priorities", "escalation", "compliance_frameworks", "scripting.deployment"].forEach(need);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(c.profile || ""))) errors.push("config: profile must be a lowercase slug (letters, digits, hyphens)");
  if (!Array.isArray(c.sla?.priorities) || c.sla.priorities.length === 0) errors.push("config: sla.priorities must be a non-empty array");
  else c.sla.priorities.forEach((p, i) => { for (const k of ["id", "name", "definition", "response", "update_cadence", "resolution_target"]) if (!p[k]) errors.push(`config: sla.priorities[${i}] missing ${k}`); });
  for (const t of Object.keys(c.targets || {})) if (!TARGET_IDS.includes(t)) errors.push(`config: unknown target "${t}" (known: ${TARGET_IDS.join(", ")})`);
  for (const b of Object.keys(c.budgets || {})) if (!TARGET_IDS.includes(b)) errors.push(`config: budget for unknown target "${b}"`);
  const secretish = /(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i;
  if (secretish.test(JSON.stringify(c))) errors.push("config: looks like it contains a credential; this file is committed, keep secrets out of it");
  return errors;
}

// ---------------------------------------------------------------- templates
function getPath(obj, p) {
  if (p === ".") return obj;
  let cur = obj;
  for (const k of p.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}

function lookup(stack, p) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const ctx = stack[i];
    if (p === ".") { if (ctx && typeof ctx === "object" && "." in ctx) return ctx["."]; return ctx; }
    const v = ctx && typeof ctx === "object" ? getPath(ctx, p) : undefined;
    if (v !== undefined) return v;
  }
  return undefined;
}

function fmt(v) {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.map(fmt).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const truthy = (v) => Array.isArray(v) ? v.length > 0 : !!v;

export function render(template, ctx, missing = new Set()) {
  const stack = Array.isArray(ctx) ? ctx : [ctx];
  // standalone section tags own their line
  let tpl = template.replace(/^[ \t]*(\{\{[#^/][^}]*\}\})[ \t]*\r?\n/gm, "$1");
  const SEC = /\{\{([#^])\s*([\w.]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/;
  let m;
  while ((m = SEC.exec(tpl))) {
    const [whole, kind, key, body] = m;
    const val = lookup(stack, key);
    let out = "";
    if (kind === "#") {
      if (Array.isArray(val)) {
        out = val.map((item, i) => {
          const itemCtx = item && typeof item === "object" && !Array.isArray(item) ? { ...item } : { ".": item };
          itemCtx.sep = i < val.length - 1 ? ", " : "";
          itemCtx.index = i + 1;
          return render(body, [...stack, itemCtx], missing);
        }).join("");
      } else if (truthy(val)) {
        out = render(body, typeof val === "object" ? [...stack, val] : stack, missing);
      }
    } else if (!truthy(val)) {
      out = render(body, stack, missing);
    }
    tpl = tpl.slice(0, m.index) + out + tpl.slice(m.index + whole.length);
  }
  tpl = tpl.replace(/\{\{\s*join\s+([\w.]+)(?:\s+"([^"]*)")?\s*\}\}/g, (_, key, sep) => {
    const v = lookup(stack, key);
    if (v === undefined) { missing.add(key); return `{{join ${key}}}`; }
    return Array.isArray(v) ? v.map(fmt).join(sep ?? ", ") : fmt(v);
  });
  tpl = tpl.replace(/\{\{\s*([\w.]+|\.)\s*\}\}/g, (_, key) => {
    const v = lookup(stack, key);
    if (v === undefined) { missing.add(key); return `{{${key}}}`; }
    return fmt(v);
  });
  return tpl;
}

// ------------------------------------------------------------------ modules
export function parseModule(text, file = "<module>") {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fm) throw new Error(`${file}: missing frontmatter block`);
  const meta = {};
  for (const line of fm[1].split(/\r?\n/)) {
    const mm = line.match(/^([\w-]+):\s*(.*)$/);
    if (mm) meta[mm[1]] = mm[2].trim();
  }
  for (const k of ["id", "title", "area", "priority"]) if (!meta[k]) throw new Error(`${file}: frontmatter missing ${k}`);
  meta.priority = Number(meta.priority);
  if (!Number.isFinite(meta.priority)) throw new Error(`${file}: priority must be a number`);
  if (!meta.command || meta.command === "none") meta.command = null;
  const sections = {};
  let current = null;
  for (const line of fm[2].split(/\r?\n/)) {
    const h = line.match(/^## (\w+)\s*$/);
    if (h) { current = h[1].toLowerCase(); sections[current] = []; continue; }
    if (current) sections[current].push(line);
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].join("\n").trim();
  return { ...meta, file, sections };
}

export function loadModules(dir = MODULES_DIR) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  const mods = files.map((f) => parseModule(fs.readFileSync(path.join(dir, f), "utf8"), f));
  const ids = new Set();
  for (const m of mods) {
    if (ids.has(m.id)) throw new Error(`duplicate module id ${m.id} (${m.file})`);
    ids.add(m.id);
    if (!CORE_MODULES.includes(m.id)) {
      for (const s of ["line", "rules", "prompt"]) if (!m.sections[s]) throw new Error(`${m.file}: missing "## ${s[0].toUpperCase() + s.slice(1)}" section`);
    }
  }
  return mods;
}

function selectModules(all, config, args, warnings) {
  const enabledCfg = config.modules || {};
  return all.filter((m) => {
    if (CORE_MODULES.includes(m.id)) {
      if (enabledCfg[m.id] === false) warnings.push(`${m.id} is disabled in the config; every pack will miss it`);
      return enabledCfg[m.id] !== false;
    }
    if (args.only && !args.only.includes(m.id)) return false;
    if (args.skip && args.skip.includes(m.id)) return false;
    if (enabledCfg[m.id] === undefined) warnings.push(`module ${m.id} is not listed under "modules" in the config; included by default`);
    return enabledCfg[m.id] !== false;
  });
}

// ------------------------------------------------------------------ helpers
const byPriority = (a, b) => a.priority - b.priority || a.id.localeCompare(b.id);

function fit(parts, budget) {
  // parts: [{id, text, priority, mandatory}], joined with "\n"
  const kept = parts.filter((p) => p.mandatory);
  const optional = parts.filter((p) => !p.mandatory).sort(byPriority);
  const size = (arr) => arr.map((p) => p.text).join("\n").length;
  const dropped = [];
  for (const p of optional) kept.push(p);
  while (budget && size(kept) > budget) {
    const idx = [...kept].reverse().findIndex((p) => !p.mandatory);
    if (idx < 0) break;
    const real = kept.length - 1 - idx;
    dropped.push(kept[real].id);
    kept.splice(real, 1);
  }
  const ordered = [...kept].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || byPriority(a, b));
  return { text: ordered.map((p) => p.text).join("\n"), dropped: dropped.reverse(), chars: size(ordered) };
}

function fitWithFallback(items, budget, { before = "", after = "" } = {}) {
  // items: [{id, priority, full, short}] in any order. Start with every short
  // form, then upgrade to the full form in priority order while it still fits.
  const sorted = [...items].sort(byPriority);
  const state = new Map(sorted.map((it) => [it.id, "short"]));
  const compose = () => before + sorted.map((it) => (state.get(it.id) === "full" ? it.full : it.short)).join("\n") + after;
  for (const it of sorted) {
    state.set(it.id, "full");
    if (budget && compose().length > budget) { state.set(it.id, "short"); }
  }
  const dropped = sorted.filter((it) => state.get(it.id) === "short").map((it) => it.id);
  const text = compose();
  return { text, dropped, chars: text.length };
}

const fieldRe =/\[[A-Z][^\]\n]{2,}\]/g;
function fields(prompt) {
  const set = new Set(prompt.match(fieldRe) || []);
  return [...set];
}

function commandTable(mods) {
  const rows = mods.filter((m) => m.command).map((m) => `| ${m.command} | ${m.title} | ${m.area} |`);
  return ["| Command | Playbook | Area |", "|---|---|---|", ...rows].join("\n");
}

// ------------------------------------------------------------------ targets
function buildAll(config, modules, args) {
  const warnings = [];
  const missing = new Set();
  const selected = selectModules(modules, config, args, warnings).sort(byPriority);
  const R = (tpl) => render(tpl || "", config, missing);
  const rendered = selected.map((m) => ({
    ...m,
    about: R(m.sections.about),
    line: R(m.sections.line),
    rules: R(m.sections.rules),
    prompt: R(m.sections.prompt),
  }));
  const profile = rendered.find((m) => m.id === "profile");
  const guard = rendered.find((m) => m.id === "guardrails");
  const work = rendered.filter((m) => !CORE_MODULES.includes(m.id));
  const budgets = config.budgets || {};
  const targetsCfg = config.targets || {};
  const wantTarget = (t) => (args.targets ? args.targets.includes(t) : targetsCfg[t] !== false);
  const co = config.company;
  const files = [];
  const report = {};

  // 1. ChatGPT custom instructions: two fields, budget each
  if (wantTarget("chatgpt-custom-instructions")) {
    const budget = budgets["chatgpt-custom-instructions"] ?? 1500;
    const blockA = (profile?.about || "").trim();
    const partsB = [
      profile ? { id: "profile", text: profile.line, priority: -1, mandatory: true, order: 0 } : null,
      ...work.map((m) => ({ id: m.id, text: m.line, priority: m.priority, mandatory: false, order: 1 })),
      guard ? { id: "guardrails", text: guard.line, priority: 999, mandatory: true, order: 2 } : null,
    ].filter(Boolean);
    const b = fit(partsB, budget);
    if (blockA.length > budget) warnings.push(`chatgpt-custom-instructions: block A is ${blockA.length} chars, over the ${budget} limit; shorten "## About" in modules/00-profile.md`);
    report["chatgpt-custom-instructions"] = { budget, blockA: blockA.length, blockB: b.chars, dropped: b.dropped };
    files.push({
      name: "chatgpt-custom-instructions.md",
      content: [
        `# ChatGPT Custom Instructions for ${co.name}`,
        "",
        "Paste each block into ChatGPT > Settings > Personalization > Custom instructions. Each field holds " + budget + " characters.",
        b.dropped.length ? `Left out for space (enable fewer modules or shorten their "## Line"): ${b.dropped.join(", ")}.` : "Every enabled module fit.",
        "",
        `## Block A: What would you like ChatGPT to know about you? (${blockA.length}/${budget})`,
        "",
        "```text", blockA, "```",
        "",
        `## Block B: How would you like ChatGPT to respond? (${b.chars}/${budget})`,
        "",
        "```text", b.text, "```",
        "",
      ].join("\n"),
    });
  }

  // 2. Custom GPT instructions: one field, budget, playbooks go to a knowledge file
  if (wantTarget("custom-gpt-instructions")) {
    const budget = budgets["custom-gpt-instructions"] ?? 8000;
    const head = [
      `You are the ${co.name} (${co.short}) operations assistant for an MSP/MSSP team.`,
      profile?.about ? profile.about : "",
      "",
      "COMMANDS: when the user types one of these, open the matching playbook in the knowledge file prompt-library.md, ask for any input marked in square brackets that was not supplied, then follow the playbook's OUTPUT section exactly.",
      commandTable(work),
      "",
    ].join("\n");
    // Every module keeps at least its one-line rule; full rules are added back in
    // priority order while the field has room.
    const body = fitWithFallback(
      work.map((m) => ({
        id: m.id,
        priority: m.priority,
        full: `${m.command ? m.command + " " : ""}${m.title.toUpperCase()}\n${m.rules}\n`,
        short: `${m.command ? m.command + " " : ""}${m.title.toUpperCase()}: ${m.line}`,
      })),
      budget - head.length,
      { before: profile ? `VOICE AND HOUSE RULES\n${profile.rules}\n` : "", after: guard ? `\nGUARDRAILS (always apply)\n${guard.rules}` : "" },
    );
    const text = head + body.text;
    report["custom-gpt-instructions"] = { budget, chars: text.length, dropped: body.dropped, oneLineOnly: body.dropped };
    files.push({
      name: "custom-gpt-instructions.md",
      content: [
        `# Custom GPT instructions for ${co.name} (${text.length}/${budget})`,
        "",
        "1. ChatGPT > Explore GPTs > Create. Paste the block below into Instructions.",
        "2. Upload prompt-library.md from this folder under Knowledge (the playbooks the commands refer to).",
        "3. Turn off Web Browsing and Code Interpreter unless a playbook needs them; keep the GPT private to your workspace because it describes internal process.",
        body.dropped.length ? `Kept to a one-line rule for space (their full playbooks still load from the knowledge file): ${body.dropped.join(", ")}.` : "Every enabled module's full rules fit.",
        "",
        "```text", text, "```",
        "",
      ].join("\n"),
    });
  }

  // 3. Claude Project instructions: full rules + inline playbooks
  if (wantTarget("claude-project-instructions")) {
    const budget = budgets["claude-project-instructions"] ?? 40000;
    const text = [
      `# ${co.name} MSP/MSSP operations assistant`,
      "",
      profile?.about || "",
      "",
      "## Voice and house rules",
      profile?.rules || "",
      "",
      "## Commands",
      "When the user types a command, ask for any bracketed input that was not supplied, then follow that playbook's OUTPUT section exactly.",
      commandTable(work),
      "",
      ...work.flatMap((m) => [`## ${m.command ? m.command + " " : ""}${m.title}`, "", "Rules:", m.rules, "", "Playbook:", "", m.prompt, ""]),
      "## Guardrails (always apply)",
      guard?.rules || "",
      "",
    ].join("\n");
    if (text.length > budget) warnings.push(`claude-project-instructions: ${text.length} chars exceeds the soft budget of ${budget}`);
    report["claude-project-instructions"] = { budget, chars: text.length, dropped: [] };
    files.push({
      name: "claude-project-instructions.md",
      content: [
        `# Claude Project instructions for ${co.name} (${text.length} chars)`,
        "",
        "Claude.ai > Projects > New project > Set project instructions: paste the block below. Optionally add prompt-library.md to the project's knowledge as well.",
        "",
        "```text", text, "```",
        "",
      ].join("\n"),
    });
  }

  // 4. Agent instructions (CLAUDE.md / AGENTS.md snippet)
  const agentBody = [
    `# ${co.name} MSP/MSSP operating rules`,
    "",
    `Generated by the msp-ai-kit skill from kit.config.json (profile "${config.profile}"). Edit the config or the modules, not this file.`,
    "",
    "## Voice and house rules",
    profile?.rules || "",
    "",
    "## Playbooks",
    `Full playbooks live in prompt-library.md next to this file (one file per playbook under prompts/). Invoke them by command:`,
    commandTable(work),
    "",
    ...work.flatMap((m) => [`### ${m.command ? m.command + " " : ""}${m.title}`, m.rules, ""]),
    "## Guardrails (always apply)",
    guard?.rules || "",
    "",
  ].join("\n");
  if (wantTarget("agent-instructions")) {
    report["agent-instructions"] = { chars: agentBody.length, dropped: [] };
    files.push({ name: "agent-instructions.md", content: agentBody });
  }
  if (wantTarget("cursor-rule")) {
    const mdc = [
      "---",
      `description: ${co.name} MSP/MSSP operating rules and playbook commands (msp-ai-kit)`,
      "globs: []",
      "alwaysApply: false",
      "---",
      agentBody,
    ].join("\n");
    report["cursor-rule"] = { chars: mdc.length, dropped: [] };
    files.push({ name: path.join("cursor", "msp-ai-kit.mdc"), content: mdc });
  }
  if (wantTarget("copilot-instructions")) {
    const text = ["<!-- Save as .github/copilot-instructions.md in a repository that hosts MSP scripts or docs. -->", "", agentBody].join("\n");
    report["copilot-instructions"] = { chars: text.length, dropped: [] };
    files.push({ name: "copilot-instructions.md", content: text });
  }

  // 5. Prompt library and per-prompt files
  const promptDoc = (m) => [
    `# ${m.title}`,
    "",
    `Command: ${m.command || "none"} | Area: ${m.area} | Module: ${m.id}`,
    "",
    "Fill every field in square brackets before sending. Fields in this playbook:",
    ...fields(m.prompt).map((f) => `- ${f}`),
    "",
    "```text", m.prompt, "```",
    "",
    "Rules this playbook assumes:",
    m.rules,
    "",
  ].join("\n");
  if (wantTarget("prompt-library")) {
    const text = [
      `# ${co.name} prompt library`,
      "",
      "Copy-paste playbooks for the service desk, sales, security, and engineering. Each one lists the fields to fill. Upload this file as knowledge for the Custom GPT or a Claude Project, or paste a single playbook into any chat.",
      "",
      "## Contents",
      ...work.map((m) => `- ${m.command || ""} ${m.title} (${m.area})`.trim()),
      "",
      "## House rules",
      profile?.rules || "",
      "",
      "## Guardrails",
      guard?.rules || "",
      "",
      ...work.map((m) => promptDoc(m).replace(/^# /, "## ")),
    ].join("\n");
    report["prompt-library"] = { chars: text.length, dropped: [] };
    files.push({ name: "prompt-library.md", content: text });
  }
  if (wantTarget("prompt-files")) {
    for (const m of work) files.push({ name: path.join("prompts", `${m.id}.md`), content: promptDoc(m) });
    report["prompt-files"] = { count: work.length };
  }

  // 6. Index and manifest
  const configHash = crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 12);
  const index = [
    `# ${co.name} MSP AI Kit, profile "${config.profile}"`,
    "",
    "| File | Paste into | Size |",
    "|---|---|---|",
    ...files.map((f) => `| ${f.name} | ${destination(f.name)} | ${f.content.length} chars |`),
    "",
    `Modules included: ${work.map((m) => m.id).join(", ")}.`,
    Object.values(report).some((r) => r.dropped?.length) ? "Some modules were trimmed from the budgeted packs; see the note at the top of each file." : "Nothing was trimmed for budget.",
    config.sla?.confirmed ? "" : "SLA numbers are working defaults (sla.confirmed is false): do not publish them client-facing until the owner approves them.",
    `Config hash ${configHash}. Rebuild: node .claude/skills/msp-ai-kit/scripts/build.mjs`,
    "",
  ].filter((l) => l !== null).join("\n");
  files.unshift({ name: "INDEX.md", content: index });
  const manifest = {
    builder: BUILDER_VERSION,
    profile: config.profile,
    configHash,
    modules: work.map((m) => ({ id: m.id, title: m.title, area: m.area, priority: m.priority, command: m.command })),
    core: CORE_MODULES.filter((id) => rendered.some((m) => m.id === id)),
    targets: report,
    slaConfirmed: !!config.sla?.confirmed,
    warnings,
  };
  files.push({ name: "manifest.json", content: JSON.stringify(manifest, null, 2) + "\n" });

  if (missing.size) warnings.push(`unresolved placeholders (add them to the config): ${[...missing].join(", ")}`);
  return { files, report, warnings, missing: [...missing], selected: rendered };
}

function destination(name) {
  if (name.startsWith("prompts/") || name.startsWith("prompts\\")) return "any chat, one playbook at a time";
  return {
    "INDEX.md": "read first",
    "chatgpt-custom-instructions.md": "ChatGPT > Settings > Personalization > Custom instructions",
    "custom-gpt-instructions.md": "ChatGPT > Create a GPT > Instructions (upload prompt-library.md as Knowledge)",
    "claude-project-instructions.md": "Claude.ai > Project > Instructions",
    "agent-instructions.md": "CLAUDE.md or AGENTS.md of an ops repo, or ~/.claude/CLAUDE.md",
    "cursor/msp-ai-kit.mdc": ".cursor/rules/ in an ops repo",
    "copilot-instructions.md": ".github/copilot-instructions.md",
    "prompt-library.md": "Custom GPT or Claude Project knowledge; also browse it directly",
    "manifest.json": "reference only",
  }[name] || "";
}

// --------------------------------------------------------------------- main
function writeFiles(outDir, files) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of files) {
    const p = path.join(outDir, f.name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, f.content);
  }
}

function verifyDir(dir, files) {
  const diffs = [];
  for (const f of files) {
    const p = path.join(dir, f.name);
    if (!fs.existsSync(p)) { diffs.push(`missing: ${f.name}`); continue; }
    if (fs.readFileSync(p, "utf8") !== f.content) diffs.push(`differs: ${f.name}`);
  }
  const walk = (d, rel = "") => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), path.join(rel, e.name)) : [path.join(rel, e.name)]);
  if (fs.existsSync(dir)) for (const rel of walk(dir)) if (!files.some((f) => f.name === rel)) diffs.push(`stale: ${rel}`);
  return diffs;
}

export function build(opts = {}) {
  const args = { sets: [], ...opts };
  const configFile = path.resolve(args.config || path.join(SKILL_DIR, "kit.config.json"));
  const config = loadConfig(configFile);
  for (const s of args.sets) applySet(config, s);
  const configErrors = validateConfig(config);
  if (configErrors.length) throw new Error(configErrors.join("\n"));
  const modules = loadModules(args.modulesDir || MODULES_DIR);
  const result = buildAll(config, modules, args);
  const outDir = path.resolve(args.out || path.join(config.output_dir || "artifacts/msp-ai-kit/out", config.profile));
  return { ...result, config, configFile, outDir };
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (args.help) { console.log(usage()); return; }
  const log = (...x) => { if (!args.quiet && !args.json) console.log(...x); };
  let r;
  try { r = build(args); } catch (e) { console.error(`msp-ai-kit: ${e.message}`); process.exit(1); }

  if (args.list) {
    const cfg = r.config;
    log(`Config: ${r.configFile}\nProfile: ${cfg.profile}\nOutput: ${r.outDir}\n`);
    log("Modules (priority, area, enabled, command):");
    for (const m of loadModules().sort(byPriority)) {
      const on = r.selected.some((s) => s.id === m.id);
      log(`  ${String(m.priority).padStart(3)}  ${m.area.padEnd(11)} ${on ? "on " : "off"}  ${m.id.padEnd(30)} ${m.command || ""}`);
    }
    log("\nTargets (enabled, budget):");
    for (const t of TARGET_IDS) log(`  ${(cfg.targets?.[t] !== false ? "on " : "off")}  ${t.padEnd(30)} ${cfg.budgets?.[t] ?? ""}`);
    return;
  }

  const hardErrors = [];
  if (r.missing.length) hardErrors.push(`unresolved placeholders: ${r.missing.join(", ")}`);
  for (const [t, rep] of Object.entries(r.report)) {
    if (t === "chatgpt-custom-instructions" && (rep.blockA > rep.budget || rep.blockB > rep.budget)) hardErrors.push(`${t} exceeds its budget`);
    if (t === "custom-gpt-instructions" && rep.chars > rep.budget) hardErrors.push(`${t} exceeds its budget`);
  }

  if (args.check) {
    for (const w of r.warnings) console.error(`warning: ${w}`);
    if (hardErrors.length) { for (const e of hardErrors) console.error(`error: ${e}`); process.exit(1); }
    log(`ok: ${r.selected.length} modules, ${r.files.length} files, no unresolved placeholders, budgets respected`);
    return;
  }

  if (args.verify) {
    const diffs = verifyDir(path.resolve(args.verify), r.files);
    if (diffs.length) { console.error(`msp-ai-kit: ${args.verify} is out of date:\n  ${diffs.join("\n  ")}\nRebuild with: node .claude/skills/msp-ai-kit/scripts/build.mjs --out ${args.verify}`); process.exit(1); }
    log(`ok: ${args.verify} matches a fresh build (${r.files.length} files)`);
    return;
  }

  if (!args.dryRun) writeFiles(r.outDir, r.files);
  if (args.json) { console.log(JSON.stringify({ outDir: r.outDir, dryRun: !!args.dryRun, files: r.files.map((f) => ({ name: f.name, chars: f.content.length })), report: r.report, warnings: r.warnings }, null, 2)); }
  else {
    log(`${args.dryRun ? "Would write" : "Wrote"} ${r.files.length} files to ${r.outDir}`);
    for (const f of r.files) log(`  ${f.name.padEnd(42)} ${String(f.content.length).padStart(6)} chars`);
    for (const [t, rep] of Object.entries(r.report)) {
      if (rep.budget) log(`  budget ${t}: ${rep.chars ?? `${rep.blockA} + ${rep.blockB}`} / ${rep.budget}${rep.dropped?.length ? `  dropped: ${rep.dropped.join(", ")}` : ""}`);
    }
    for (const w of r.warnings) log(`  warning: ${w}`);
  }
  if (hardErrors.length) { for (const e of hardErrors) console.error(`error: ${e}`); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
