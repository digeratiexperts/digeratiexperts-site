#!/usr/bin/env node
// MSP AI Kit builder. Renders the prompt modules in ../modules with the values in
// kit.config.json into copy-paste packs for ChatGPT, Custom GPTs, Claude Projects,
// Claude Code / Codex (CLAUDE.md, AGENTS.md), Cursor, GitHub Copilot, a printable
// cheat sheet and a claude.ai-uploadable skill zip. Node 18+, no dependencies.
//
//   node .claude/skills/msp-ai-kit/scripts/build.mjs                 # build every enabled target
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --list          # show modules, targets, budgets
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --dry-run       # plan + budgets, write nothing
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --check         # validate config (schema) + modules, exit 1 on error
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --verify <dir>  # exit 1 if <dir> differs from a fresh build
//   node .claude/skills/msp-ai-kit/scripts/build.mjs --diff <dir>    # what a fresh build would change in <dir>
//
// Options
//   --config <file>        control file (default: kit.config.json next to this skill); may "extends" another
//   --out <dir>            output directory (default: <output_dir>/<profile> from the config)
//   --only a,b             build only these module ids (plus profile and guardrails)
//   --skip a,b             leave these module ids out
//   --targets a,b          build only these targets
//   --set key.path=value   override any config value (JSON or string), repeatable
//   --json                 machine-readable summary on stdout
//   --quiet                errors only
//
// Files under ../references/*.md are copied verbatim into <out>/references/ (target
// reference-files) so playbooks that cite them travel with the pack. Every build
// writes manifest.json with a sha256 per file; when a previous manifest exists in
// the output folder, CHANGES.md lists what changed since it.
//
// Module file format (modules/NN-id.md): frontmatter (id, title, area, priority,
// command) then sections "## About", "## Line" (one sentence), "## Brief" (three
// bullets), "## Rules", "## Prompt", "## Example", "## Notes". Templates use
// {{path}}, {{join path}}, {{join path "; "}}, {{#path}}...{{/path}} (repeat for
// arrays, once for truthy values, {{sep}} = ", " between items), {{^path}}...{{/path}}
// (render when empty or false) and {{.}} for the current array item.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const BUILDER_VERSION = "1.2.0";
const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODULES_DIR = path.join(SKILL_DIR, "modules");
const REFERENCES_DIR = path.join(SKILL_DIR, "references");
const SCHEMA_FILE = path.join(SKILL_DIR, "kit.schema.json");
const CORE_MODULES = ["profile", "guardrails"];
export const TARGET_IDS = [
  "chatgpt-custom-instructions",
  "custom-gpt-instructions",
  "claude-project-instructions",
  "agent-instructions",
  "cursor-rule",
  "copilot-instructions",
  "prompt-library",
  "prompt-files",
  "reference-files",
  "cheat-sheet",
  "claude-skill-zip",
];
const VOLATILE_FILES = new Set(["CHANGES.md"]);

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
      case "--diff": a.diff = next(); break;
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
  const out = [];
  for (const l of src.split("\n").slice(1)) { if (!l.startsWith("//")) break; out.push(l.replace(/^\/\/ ?/, "")); }
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

export function deepMerge(base, overlay) {
  if (Array.isArray(overlay) || overlay === null || typeof overlay !== "object") return overlay;
  if (Array.isArray(base) || base === null || typeof base !== "object") base = {};
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out;
}

function readJson(file) {
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch (e) { throw new Error(`cannot read config ${file}: ${e.message}`); }
  try { return JSON.parse(raw); } catch (e) { throw new Error(`${file} is not valid JSON: ${e.message}`); }
}

export function loadConfig(file, seen = new Set()) {
  const abs = path.resolve(file);
  if (seen.has(abs)) throw new Error(`config extends loop at ${abs}`);
  seen.add(abs);
  const own = readJson(abs);
  let merged = own;
  if (own.extends) {
    const base = loadConfig(path.resolve(path.dirname(abs), own.extends), seen);
    const { extends: _e, ...rest } = own;
    merged = deepMerge(base, rest);
  }
  const { extends: _x, $schema: _s, ...clean } = merged;
  return stripComments(clean);
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

// A deliberately small JSON-schema (draft-07) subset: enough for kit.schema.json.
export function validateAgainstSchema(value, schema, where = "config", errors = []) {
  if (!schema || typeof schema !== "object") return errors;
  const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value;
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = allowed.some((t) => t === type || (t === "number" && type === "integer"));
    if (!ok) { errors.push(`${where}: expected ${allowed.join(" or ")}, got ${type}`); return errors; }
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${where}: must be one of ${schema.enum.join(", ")}`);
  if (type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${where}: must not be empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where}: "${value}" does not match ${schema.pattern}`);
    if (schema.format === "uri" && !/^https?:\/\/\S+$/.test(value)) errors.push(`${where}: "${value}" is not an http(s) URL`);
    if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${where}: "${value}" is not an email address`);
  }
  if (type === "integer" || type === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${where}: must be at least ${schema.minimum}`);
  }
  if (type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${where}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((v, i) => validateAgainstSchema(v, schema.items, `${where}[${i}]`, errors));
  }
  if (type === "object") {
    for (const r of schema.required || []) if (value[r] === undefined) errors.push(`${where}: missing required key "${r}"`);
    const props = schema.properties || {};
    const patterns = Object.entries(schema.patternProperties || {}).map(([p, s]) => [new RegExp(p), s]);
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) { validateAgainstSchema(v, props[k], `${where}.${k}`, errors); continue; }
      const pat = patterns.find(([re]) => re.test(k));
      if (pat) { validateAgainstSchema(v, pat[1], `${where}.${k}`, errors); continue; }
      if (schema.additionalProperties === false) errors.push(`${where}: unknown key "${k}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validateAgainstSchema(v, schema.additionalProperties, `${where}.${k}`, errors);
    }
  }
  return errors;
}

function validateConfig(c, moduleIds) {
  const errors = [];
  if (fs.existsSync(SCHEMA_FILE)) {
    const schema = readJson(SCHEMA_FILE);
    // "_" comment keys were stripped already; "extends" and "$schema" too
    validateAgainstSchema(c, schema, "config", errors);
  }
  for (const t of Object.keys(c.targets || {})) if (!TARGET_IDS.includes(t)) errors.push(`config.targets: unknown target "${t}" (known: ${TARGET_IDS.join(", ")})`);
  for (const b of Object.keys(c.budgets || {})) if (!TARGET_IDS.includes(b)) errors.push(`config.budgets: budget for unknown target "${b}"`);
  for (const m of Object.keys(c.modules || {})) if (!moduleIds.includes(m)) errors.push(`config.modules: unknown module "${m}" (known: ${moduleIds.join(", ")})`);
  const secretish = /(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i;
  if (secretish.test(JSON.stringify(c))) errors.push("config: looks like it contains a credential; this file is committed, keep secrets out of it");
  return errors;
}

// ---------------------------------------------------------------- templates
function getPath(obj, p) {
  if (p === ".") return obj;
  let cur = obj;
  for (const k of p.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
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
      for (const s of ["line", "brief", "rules", "prompt"]) if (!m.sections[s]) throw new Error(`${m.file}: missing "## ${s[0].toUpperCase() + s.slice(1)}" section`);
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

function fitLadder(items, budget, { before = "", after = "" } = {}) {
  // items: [{id, priority, levels: [shortest, ..., fullest]}]. Start every item at its
  // shortest form, then upgrade one level at a time in priority order while it fits.
  // If even the shortest forms overflow, drop whole items from the lowest priority up.
  const sorted = [...items].sort(byPriority);
  const level = new Map(sorted.map((it) => [it.id, 0]));
  const removed = new Set();
  const compose = () => before + sorted.filter((it) => !removed.has(it.id)).map((it) => it.levels[level.get(it.id)]).join("\n") + after;
  const maxLevel = Math.max(...sorted.map((it) => it.levels.length - 1));
  for (let i = sorted.length - 1; budget && compose().length > budget && i >= 0; i--) removed.add(sorted[i].id);
  for (let l = 1; l <= maxLevel; l++) {
    for (const it of sorted) {
      if (removed.has(it.id)) continue;
      const prev = level.get(it.id);
      if (it.levels.length - 1 < l || prev !== l - 1) continue; // only climb one rung from where the item actually sits
      level.set(it.id, l);
      if (budget && compose().length > budget) level.set(it.id, prev);
    }
  }
  const text = compose();
  const names = ["line", "brief", "full"];
  const levelsUsed = Object.fromEntries(sorted.map((it) => [it.id, removed.has(it.id) ? "dropped" : names[level.get(it.id)] || `level ${level.get(it.id)}`]));
  const dropped = sorted.filter((it) => removed.has(it.id) || level.get(it.id) < it.levels.length - 1).map((it) => it.id);
  return { text, chars: text.length, levelsUsed, dropped, removed: [...removed] };
}

const fieldRe = /\[[A-Z][^\]\n]{2,}\]/g;
function fields(prompt) { return [...new Set(prompt.match(fieldRe) || [])]; }

function commandTable(mods) {
  const rows = mods.filter((m) => m.command).map((m) => `| ${m.command} | ${m.title} | ${m.area} |`);
  return ["| Command | Playbook | Area |", "|---|---|---|", ...rows].join("\n");
}

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

// ------------------------------------------------------------------- zip (store method, deterministic)
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function makeZip(entries) {
  // entries: [{name, data: Buffer|string}] ; fixed DOS timestamp 2026-01-01 00:00 for reproducible output
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}
export const _zlibPresent = !!zlib; // kept for future deflate support; store method is intentional for diffability

// ------------------------------------------------------------------ targets
function buildAll(config, modules, args) {
  const warnings = [];
  const missing = new Set();
  const selected = selectModules(modules, config, args, warnings).sort(byPriority);
  const R = (tpl) => render(tpl || "", config, missing);
  const rendered = selected.map((m) => ({
    ...m,
    about: R(m.sections.about), line: R(m.sections.line), brief: R(m.sections.brief),
    rules: R(m.sections.rules), prompt: R(m.sections.prompt), example: R(m.sections.example),
  }));
  const profile = rendered.find((m) => m.id === "profile");
  const guard = rendered.find((m) => m.id === "guardrails");
  const work = rendered.filter((m) => !CORE_MODULES.includes(m.id));
  for (const m of work) if (!m.example) warnings.push(`module ${m.id} has no "## Example"; add a worked example for consistency`);
  const budgets = config.budgets || {};
  const targetsCfg = config.targets || {};
  const wantTarget = (t) => (args.targets ? args.targets.includes(t) : targetsCfg[t] !== false);
  const co = config.company;
  const files = [];
  const report = {};
  const kitVersion = config.version || "0.0.0";

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
        `# ChatGPT Custom Instructions for ${co.name}`, "",
        "Paste each block into ChatGPT > Settings > Personalization > Custom instructions. Each field holds " + budget + " characters.",
        b.dropped.length ? `Left out for space (enable fewer modules or shorten their "## Line"): ${b.dropped.join(", ")}.` : "Every enabled module fit.", "",
        `## Block A: What would you like ChatGPT to know about you? (${blockA.length}/${budget})`, "", "```text", blockA, "```", "",
        `## Block B: How would you like ChatGPT to respond? (${b.chars}/${budget})`, "", "```text", b.text, "```", "",
      ].join("\n"),
    });
  }

  // 2. Custom GPT instructions: one field; line -> brief -> full ladder per module
  if (wantTarget("custom-gpt-instructions")) {
    const budget = budgets["custom-gpt-instructions"] ?? 8000;
    const head = [
      `You are the ${co.name} (${co.short}) operations assistant for an MSP/MSSP team.`,
      profile?.about ? profile.about : "", "",
      "COMMANDS: when the user types one of these, open the matching playbook in the knowledge file prompt-library.md, ask for any input marked in square brackets that was not supplied, then follow the playbook's OUTPUT section exactly. Worked examples live under each playbook there.",
      commandTable(work), "",
    ].join("\n");
    const body = fitLadder(
      work.map((m) => {
        const label = `${m.command ? m.command + " " : ""}${m.title.toUpperCase()}`;
        return { id: m.id, priority: m.priority, levels: [`${label}: ${m.line}`, `${label}\n${m.brief}\n`, `${label}\n${m.rules}\n`] };
      }),
      budget - head.length,
      { before: profile ? `VOICE AND HOUSE RULES\n${profile.rules}\n` : "", after: guard ? `\nGUARDRAILS (always apply)\n${guard.rules}` : "" },
    );
    const text = head + body.text;
    const notFull = Object.entries(body.levelsUsed).filter(([, l]) => l !== "full");
    report["custom-gpt-instructions"] = { budget, chars: text.length, dropped: body.dropped, removed: body.removed, levels: body.levelsUsed };
    if (body.removed.length) warnings.push(`custom-gpt-instructions: left out entirely for space (commands still resolve from the knowledge file): ${body.removed.join(", ")}`);
    files.push({
      name: "custom-gpt-instructions.md",
      content: [
        `# Custom GPT instructions for ${co.name} (${text.length}/${budget})`, "",
        "1. ChatGPT > Explore GPTs > Create. Paste the block below into Instructions.",
        "2. Upload prompt-library.md and every file under references/ from this folder as Knowledge (the playbooks and the DE reference pack the commands refer to).",
        "3. Turn off Web Browsing and Code Interpreter unless a playbook needs them; keep the GPT private to your workspace because it describes internal process.",
        notFull.length ? `Compressed for space (full playbooks still load from the knowledge file): ${notFull.map(([id, l]) => `${id} (${l})`).join(", ")}.` : "Every enabled module's full rules fit.", "",
        "```text", text, "```", "",
      ].join("\n"),
    });
  }

  const exampleBlock = (m) => (m.example ? ["", "Worked example:", "", m.example] : []);

  // 3. Claude Project instructions: full rules + inline playbooks + examples
  if (wantTarget("claude-project-instructions")) {
    const budget = budgets["claude-project-instructions"] ?? 60000;
    const text = [
      `# ${co.name} MSP/MSSP operations assistant`, "", profile?.about || "", "",
      "## Voice and house rules", profile?.rules || "", "",
      "## Commands", "When the user types a command, ask for any bracketed input that was not supplied, then follow that playbook's OUTPUT section exactly. Match the shape and depth of the worked example.",
      commandTable(work), "",
      ...work.flatMap((m) => [`## ${m.command ? m.command + " " : ""}${m.title}`, "", "Rules:", m.rules, "", "Playbook:", "", m.prompt, ...exampleBlock(m), ""]),
      "## Guardrails (always apply)", guard?.rules || "", "",
    ].join("\n");
    if (text.length > budget) warnings.push(`claude-project-instructions: ${text.length} chars exceeds the soft budget of ${budget}`);
    report["claude-project-instructions"] = { budget, chars: text.length, dropped: [] };
    files.push({
      name: "claude-project-instructions.md",
      content: [`# Claude Project instructions for ${co.name} (${text.length} chars)`, "", "Claude.ai > Projects > New project > Set project instructions: paste the block below. Add prompt-library.md and the references/ files to the project's knowledge as well.", "", "```text", text, "```", ""].join("\n"),
    });
  }

  // 4. Agent instructions (CLAUDE.md / AGENTS.md snippet), Cursor, Copilot
  const agentBody = [
    `# ${co.name} MSP/MSSP operating rules`, "",
    `Generated by the msp-ai-kit skill ${kitVersion} from kit.config.json (profile "${config.profile}"). Edit the config or the modules, not this file.`, "",
    "## Voice and house rules", profile?.rules || "", "",
    "## Playbooks", "Full playbooks with worked examples live in prompt-library.md next to this file (one file per playbook under prompts/). Invoke them by command:", commandTable(work), "",
    ...work.flatMap((m) => [`### ${m.command ? m.command + " " : ""}${m.title}`, m.rules, ""]),
    "## Guardrails (always apply)", guard?.rules || "", "",
  ].join("\n");
  if (wantTarget("agent-instructions")) { report["agent-instructions"] = { chars: agentBody.length, dropped: [] }; files.push({ name: "agent-instructions.md", content: agentBody }); }
  if (wantTarget("cursor-rule")) {
    const mdc = ["---", `description: ${co.name} MSP/MSSP operating rules and playbook commands (msp-ai-kit)`, "globs: []", "alwaysApply: false", "---", agentBody].join("\n");
    report["cursor-rule"] = { chars: mdc.length, dropped: [] };
    files.push({ name: path.posix.join("cursor", "msp-ai-kit.mdc"), content: mdc });
  }
  if (wantTarget("copilot-instructions")) {
    const text = ["<!-- Save as .github/copilot-instructions.md in a repository that hosts MSP scripts or docs. -->", "", agentBody].join("\n");
    report["copilot-instructions"] = { chars: text.length, dropped: [] };
    files.push({ name: "copilot-instructions.md", content: text });
  }

  // 5. Prompt library and per-prompt files
  const promptDoc = (m) => [
    `# ${m.title}`, "", `Command: ${m.command || "none"} | Area: ${m.area} | Module: ${m.id}`, "",
    "Fill every field in square brackets before sending. Fields in this playbook:", ...fields(m.prompt).map((f) => `- ${f}`), "",
    "```text", m.prompt, "```", "",
    "Rules this playbook assumes:", m.rules, "",
    ...(m.example ? ["Worked example (abridged):", "", m.example, ""] : []),
  ].join("\n");
  if (wantTarget("prompt-library")) {
    const text = [
      `# ${co.name} prompt library`, "",
      "Copy-paste playbooks for the service desk, sales, security, and engineering. Each one lists the fields to fill and ends with a worked example. Upload this file as knowledge for the Custom GPT or a Claude Project, or paste a single playbook into any chat.", "",
      "## Contents", ...work.map((m) => `- ${m.command || ""} ${m.title} (${m.area})`.trim()), "",
      "## House rules", profile?.rules || "", "", "## Guardrails", guard?.rules || "", "",
      ...work.map((m) => promptDoc(m).replace(/^# /, "## ")),
    ].join("\n");
    report["prompt-library"] = { chars: text.length, dropped: [] };
    files.push({ name: "prompt-library.md", content: text });
  }
  if (wantTarget("prompt-files")) {
    for (const m of work) files.push({ name: path.posix.join("prompts", `${m.id}.md`), content: promptDoc(m) });
    report["prompt-files"] = { count: work.length };
  }

  // 5b. Reference documents shipped verbatim
  const refs = fs.existsSync(REFERENCES_DIR) ? fs.readdirSync(REFERENCES_DIR).filter((f) => f.endsWith(".md")).sort() : [];
  if (wantTarget("reference-files")) {
    for (const f of refs) files.push({ name: path.posix.join("references", f), content: fs.readFileSync(path.join(REFERENCES_DIR, f), "utf8") });
    report["reference-files"] = { count: refs.length };
  }

  // 5c. Printable cheat sheet (single self-contained HTML, DE tokens, print styles)
  if (wantTarget("cheat-sheet")) {
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cards = work.map((m) => `
      <article class="card">
        <header><span class="cmd">${esc(m.command || "")}</span><h2>${esc(m.title)}</h2><span class="area">${esc(m.area)}</span></header>
        <p class="when">${esc(m.line)}</p>
        <ul>${m.brief.split("\n").filter((l) => l.trim()).map((l) => `<li>${esc(l.replace(/^-\s*/, ""))}</li>`).join("")}</ul>
        <p class="fields"><strong>Fill in:</strong> ${fields(m.prompt).map(esc).join(", ") || "see playbook"}</p>
      </article>`).join("\n");
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(co.name)} AI playbooks</title>
<style>
:root{--well:#050312;--paper:#f7f5f2;--raised:#151217;--hair:rgba(255,255,255,.12);--mag:#D3126A;--lav:#A78BFA;--ink:#1a1620;--muted:#6b6672}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 "Space Grotesk","Segoe UI",system-ui,sans-serif;background:var(--paper);color:var(--ink)}
.top{background:var(--well);color:var(--paper);padding:28px 32px;border-bottom:4px solid var(--mag)}
.top .brand{color:var(--mag);font:700 11px/1 Oxanium,"Space Grotesk",sans-serif;letter-spacing:.12em}
.top h1{margin:6px 0 4px;font-size:26px;font-weight:600}.top p{margin:0;color:rgba(247,245,242,.7)}
main{padding:24px 32px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{background:#fff;border:1px solid #e6e2dd;border-radius:12px;padding:16px;break-inside:avoid;page-break-inside:avoid}
.card header{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.card h2{margin:0;font-size:16px;font-weight:600;flex:1}
.cmd{font:600 13px "Cascadia Mono",Consolas,monospace;color:#fff;background:var(--mag);padding:2px 8px;border-radius:6px}
.area{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.when{margin:8px 0 6px;color:#3a3442}ul{margin:0 0 8px 18px;padding:0}li{margin:2px 0}.fields{margin:0;font-size:12px;color:var(--muted)}
.rules{grid-column:1/-1;background:var(--raised);color:var(--paper);border-radius:12px;padding:16px 20px}.rules h2{margin:0 0 8px;font-size:15px}.rules ul{margin:0 0 0 18px}
footer{padding:12px 32px 28px;color:var(--muted);font-size:12px}
@media print{body{background:#fff}.top{-webkit-print-color-adjust:exact;print-color-adjust:exact}main{padding:12px 16px;gap:10px;grid-template-columns:repeat(2,1fr)}.card{border-radius:6px}.rules{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:12mm}}
</style></head><body>
<div class="top"><div class="brand">${esc(co.name.toUpperCase())}</div><h1>AI playbooks: what to ask and how</h1><p>${esc(work.length)} playbooks. Type the command in the Custom GPT or Claude Project, fill in the bracketed fields, and follow the output. Internal use; SLA figures are working defaults until approved.</p></div>
<main>
${cards}
<section class="rules"><h2>House rules and guardrails</h2><ul>${[...(profile?.rules || "").split("\n"), ...(guard?.rules || "").split("\n")].filter((l) => l.trim()).map((l) => `<li>${esc(l.replace(/^-\s*/, ""))}</li>`).join("")}</ul></section>
</main>
<footer>Generated by msp-ai-kit ${esc(kitVersion)} for profile ${esc(config.profile)}. Regenerate with node .claude/skills/msp-ai-kit/scripts/build.mjs.</footer>
</body></html>
`;
    report["cheat-sheet"] = { chars: html.length };
    files.push({ name: "cheat-sheet.html", content: html });
  }

  // 5d. claude.ai-uploadable skill zip (SKILL.md at the top of a folder, plus knowledge)
  if (wantTarget("claude-skill-zip")) {
    const skillMd = [
      "---",
      `name: ${co.short.toLowerCase()}-msp-playbooks`,
      `description: ${co.name} MSP/MSSP operating rules and ${work.length} playbooks (${work.filter((m) => m.command).map((m) => m.command).join(", ")}). Use for service desk triage, SLA watch, onboarding, KB articles, client comms, proposals, ROI, QBRs, security alert triage, vulnerability prioritization, compliance mapping, incident comms, RMM scripting and endpoint provisioning.`,
      "---", "", agentBody, "",
      "## Playbooks", "", "Read prompt-library.md in this skill for the full playbook and worked example of each command; references/ holds the DE scripting pack.", "",
    ].join("\n");
    const lib = files.find((f) => f.name === "prompt-library.md");
    const entries = [
      { name: "msp-ai-kit/SKILL.md", data: skillMd },
      ...(lib ? [{ name: "msp-ai-kit/prompt-library.md", data: lib.content }] : []),
      ...refs.map((f) => ({ name: `msp-ai-kit/references/${f}`, data: fs.readFileSync(path.join(REFERENCES_DIR, f), "utf8") })),
    ];
    const zip = makeZip(entries);
    report["claude-skill-zip"] = { bytes: zip.length, entries: entries.length };
    files.push({ name: "msp-ai-kit-claude-skill.zip", content: zip, binary: true });
  }

  // 6. Index and manifest (with per-file hashes)
  const configHash = sha256(JSON.stringify(config)).slice(0, 12);
  const index = [
    `# ${co.name} MSP AI Kit ${kitVersion}, profile "${config.profile}"`, "",
    "| File | Paste into | Size |", "|---|---|---|",
    ...files.map((f) => `| ${f.name} | ${destination(f.name)} | ${f.binary ? `${f.content.length} bytes` : `${f.content.length} chars`} |`), "",
    `Modules included: ${work.map((m) => m.id).join(", ")}.`,
    Object.values(report).some((r) => r.dropped?.length) ? "Some modules were compressed or trimmed in the budgeted packs; see the note at the top of each file." : "Nothing was trimmed for budget.",
    config.sla?.confirmed ? "" : "SLA numbers are working defaults (sla.confirmed is false): do not publish them client-facing until the owner approves them.",
    `Config hash ${configHash}. Rebuild: node .claude/skills/msp-ai-kit/scripts/build.mjs`, "",
  ].filter((l) => l !== null).join("\n");
  files.unshift({ name: "INDEX.md", content: index });
  const fileHashes = Object.fromEntries(files.map((f) => [f.name, sha256(f.content)]));
  const manifest = {
    builder: BUILDER_VERSION,
    kitVersion,
    profile: config.profile,
    configHash,
    modules: work.map((m) => ({ id: m.id, title: m.title, area: m.area, priority: m.priority, command: m.command, hasExample: !!m.example })),
    core: CORE_MODULES.filter((id) => rendered.some((m) => m.id === id)),
    targets: report,
    slaConfirmed: !!config.sla?.confirmed,
    files: fileHashes,
    warnings,
  };
  files.push({ name: "manifest.json", content: JSON.stringify(manifest, null, 2) + "\n" });

  if (missing.size) warnings.push(`unresolved placeholders (add them to the config): ${[...missing].join(", ")}`);
  return { files, report, warnings, missing: [...missing], selected: rendered, manifest };
}

function destination(name) {
  const n = name.replace(/\\/g, "/");
  if (n.startsWith("prompts/")) return "any chat, one playbook at a time";
  if (n.startsWith("references/")) return "knowledge file next to prompt-library.md; cited by the /script and /provision playbooks";
  return {
    "INDEX.md": "read first",
    "chatgpt-custom-instructions.md": "ChatGPT > Settings > Personalization > Custom instructions",
    "custom-gpt-instructions.md": "ChatGPT > Create a GPT > Instructions (upload prompt-library.md + references/ as Knowledge)",
    "claude-project-instructions.md": "Claude.ai > Project > Instructions",
    "agent-instructions.md": "CLAUDE.md or AGENTS.md of an ops repo, or ~/.claude/CLAUDE.md (scripts/install-targets.mjs does this)",
    "cursor/msp-ai-kit.mdc": ".cursor/rules/ in an ops repo",
    "copilot-instructions.md": ".github/copilot-instructions.md",
    "prompt-library.md": "Custom GPT or Claude Project knowledge; also browse it directly",
    "cheat-sheet.html": "print or share with staff; one card per playbook",
    "msp-ai-kit-claude-skill.zip": "claude.ai > Settings > Capabilities > Skills > Upload",
    "manifest.json": "reference only (per-file hashes)",
  }[n] || "";
}

// --------------------------------------------------------------------- main
function readPreviousManifest(outDir) {
  const p = path.join(outDir, "manifest.json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

export function diffAgainstManifest(prev, files) {
  const prevFiles = prev?.files || {};
  const now = Object.fromEntries(files.filter((f) => !VOLATILE_FILES.has(f.name)).map((f) => [f.name, sha256(f.content)]));
  const added = Object.keys(now).filter((n) => !(n in prevFiles) && n !== "manifest.json");
  const removed = Object.keys(prevFiles).filter((n) => !(n in now));
  const changed = Object.keys(now).filter((n) => n in prevFiles && prevFiles[n] !== now[n] && n !== "manifest.json");
  return { added, removed, changed, previous: prev ? { kitVersion: prev.kitVersion, configHash: prev.configHash, builder: prev.builder } : null };
}

function changesMarkdown(diff, manifest) {
  const list = (arr) => (arr.length ? arr.map((n) => `- ${n}`).join("\n") : "- none");
  return [
    `# Changes since the previous build`, "",
    `Previous: kit ${diff.previous?.kitVersion ?? "?"}, config ${diff.previous?.configHash ?? "?"}, builder ${diff.previous?.builder ?? "?"}.`,
    `Now: kit ${manifest.kitVersion}, config ${manifest.configHash}, builder ${manifest.builder}.`, "",
    "## Changed", list(diff.changed), "", "## Added", list(diff.added), "", "## Removed", list(diff.removed), "",
    "Generated automatically; INDEX.md and manifest.json change on every build and are listed only when their content differs.", "",
  ].join("\n");
}

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
    const on = fs.readFileSync(p);
    const want = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, "utf8");
    if (!on.equals(want)) diffs.push(`differs: ${f.name}`);
  }
  const walk = (d, rel = "") => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), path.posix.join(rel, e.name)) : [path.posix.join(rel, e.name)]);
  if (fs.existsSync(dir)) for (const rel of walk(dir)) if (!files.some((f) => f.name === rel) && !VOLATILE_FILES.has(rel)) diffs.push(`stale: ${rel}`);
  return diffs;
}

export function build(opts = {}) {
  const args = { sets: [], ...opts };
  const configFile = path.resolve(args.config || path.join(SKILL_DIR, "kit.config.json"));
  const config = loadConfig(configFile);
  for (const s of args.sets) applySet(config, s);
  const modules = loadModules(args.modulesDir || MODULES_DIR);
  const configErrors = validateConfig(config, modules.map((m) => m.id));
  if (configErrors.length) throw new Error(configErrors.join("\n"));
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
    log(`Config: ${r.configFile}\nProfile: ${cfg.profile} (kit ${cfg.version || "unversioned"})\nOutput: ${r.outDir}\n`);
    log("Modules (priority, area, enabled, command, example):");
    for (const m of loadModules().sort(byPriority)) {
      const on = r.selected.some((s) => s.id === m.id);
      log(`  ${String(m.priority).padStart(3)}  ${m.area.padEnd(11)} ${on ? "on " : "off"}  ${m.id.padEnd(30)} ${(m.command || "").padEnd(10)} ${m.sections.example ? "example" : ""}`);
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
    log(`ok: ${r.selected.length} modules, ${r.files.length} files, schema valid, no unresolved placeholders, budgets respected`);
    return;
  }

  if (args.verify) {
    const diffs = verifyDir(path.resolve(args.verify), r.files);
    if (diffs.length) { console.error(`msp-ai-kit: ${args.verify} is out of date:\n  ${diffs.join("\n  ")}\nRebuild with: node .claude/skills/msp-ai-kit/scripts/build.mjs --out ${args.verify}`); process.exit(1); }
    log(`ok: ${args.verify} matches a fresh build (${r.files.length} files)`);
    return;
  }

  if (args.diff) {
    const prev = readPreviousManifest(path.resolve(args.diff));
    if (!prev) { console.error(`msp-ai-kit: no manifest.json in ${args.diff}`); process.exit(1); }
    const d = diffAgainstManifest(prev, r.files);
    if (args.json) console.log(JSON.stringify(d, null, 2));
    else log(changesMarkdown(d, r.manifest));
    return;
  }

  const prev = readPreviousManifest(r.outDir);
  const diff = prev ? diffAgainstManifest(prev, r.files) : null;
  if (diff && !args.dryRun) r.files.push({ name: "CHANGES.md", content: changesMarkdown(diff, r.manifest) });
  if (!args.dryRun) writeFiles(r.outDir, r.files);
  if (args.json) {
    console.log(JSON.stringify({ outDir: r.outDir, dryRun: !!args.dryRun, files: r.files.map((f) => ({ name: f.name, size: f.content.length })), report: r.report, warnings: r.warnings, changes: diff }, null, 2));
  } else {
    log(`${args.dryRun ? "Would write" : "Wrote"} ${r.files.length} files to ${r.outDir}`);
    for (const f of r.files) log(`  ${f.name.padEnd(42)} ${String(f.content.length).padStart(6)} ${f.binary ? "bytes" : "chars"}`);
    for (const [t, rep] of Object.entries(r.report)) {
      if (rep.budget) log(`  budget ${t}: ${rep.chars ?? `${rep.blockA} + ${rep.blockB}`} / ${rep.budget}${rep.dropped?.length ? `  compressed: ${rep.dropped.join(", ")}` : ""}`);
    }
    if (diff) log(`  changes since previous build: ${diff.changed.length} changed, ${diff.added.length} added, ${diff.removed.length} removed${args.dryRun ? "" : " (see CHANGES.md)"}`);
    for (const w of r.warnings) log(`  warning: ${w}`);
  }
  if (hardErrors.length) { for (const e of hardErrors) console.error(`error: ${e}`); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
