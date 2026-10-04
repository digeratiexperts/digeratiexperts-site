#!/usr/bin/env node
/**
 * Recraft icon generator for Digerati Experts (no dependencies; Node 20+).
 *
 *   node recraft.mjs check
 *       Verify the key and show remaining credits (GET /v1/users/me, free).
 *   node recraft.mjs generate --subject "<what the icon shows>" --name <slug> [--set <set>]
 *                    [--n 2] [--spec <style.json>] [--style-id <uuid>] [--model <id>] [--dry-run]
 *       Generate SVG candidates, clean them, write a manifest and a review sheet.
 *   node recraft.mjs create-style --name <slug> <ref1.png> [ref2.png ...] [--dry-run]
 *       Upload 1-5 raster references as a reusable vector style; saves its style_id.
 *   node recraft.mjs clean <in.svg> [--out <out.svg>] [--keep-colour]
 *       Run the cleaner on an SVG you already have (offline).
 *
 * Key: RECRAFT_API_KEY from the environment, else from the first .env found by
 * walking up from the working directory or this script. Never printed.
 * Every generate / create-style call spends Recraft credits; --dry-run does not.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const API_BASE = "https://external.api.recraft.ai/v1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = path.resolve(HERE, "..");
export const DEFAULT_SPEC = path.join(SKILL_DIR, "references", "de-icon-style.json");
const KEY_NAME = "RECRAFT_API_KEY";

// ---------------------------------------------------------------- key + paths

function* walkUp(start, maxLevels = 8) {
  let d = path.resolve(start);
  for (let i = 0; i < maxLevels; i++) {
    yield d;
    const parent = path.dirname(d);
    if (parent === d) return;
    d = parent;
  }
}

function parseEnvFile(file) {
  const out = {};
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

export function loadApiKey({ env = process.env, starts = [process.cwd(), HERE] } = {}) {
  if (env[KEY_NAME]?.trim()) return env[KEY_NAME].trim();
  const seen = new Set();
  for (const start of starts) {
    for (const dir of walkUp(start)) {
      const file = path.join(dir, ".env");
      if (seen.has(file) || !existsSync(file)) continue;
      seen.add(file);
      const v = parseEnvFile(file)[KEY_NAME];
      if (v) return v;
    }
  }
  return null;
}

/** Repository root: the nearest ancestor holding package.json, else the working directory. */
export function repoRoot(start = process.cwd()) {
  for (const dir of walkUp(start, 12)) if (existsSync(path.join(dir, "package.json"))) return dir;
  return process.cwd();
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "icon";
}

export function today(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- payloads

export function loadSpec(file = DEFAULT_SPEC) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function buildPrompt(spec, subject) {
  if (!subject || !String(subject).trim()) throw new Error("--subject is required (what the icon shows)");
  const tpl = spec.prompt_template || "{subject}";
  return tpl.includes("{subject}") ? tpl.replace("{subject}", String(subject).trim()) : `${tpl} ${subject}`;
}

/**
 * The JSON body for POST /v1/images/generations. With a style_id the model
 * switches to the V4 styles family (recraftv4_styles_vector), which requires
 * a style and ignores curated style names.
 */
export function buildGenerationPayload(spec, { subject, n, styleId, model } = {}) {
  const body = {
    prompt: buildPrompt(spec, subject),
    model: model || (styleId ? "recraftv4_styles_vector" : spec.model),
    n: Number(n ?? spec.n ?? 1),
    size: spec.size,
    response_format: "url",
  };
  if (!Number.isInteger(body.n) || body.n < 1 || body.n > 6) throw new Error("--n must be an integer from 1 to 6");
  if (spec.negative_prompt) body.negative_prompt = spec.negative_prompt;
  if (spec.controls) body.controls = spec.controls;
  if (styleId) {
    if (!/^[0-9a-f-]{36}$/i.test(styleId)) throw new Error("--style-id must be a UUID");
    body.style_id = styleId;
    body.style_match = "precise";
  }
  if (!/vector/.test(body.model)) throw new Error(`model ${body.model} is not a vector model; icons must be SVG`);
  return body;
}

// ---------------------------------------------------------------- SVG cleaner

const NAMED_WHITE = new Set(["#fff", "#ffffff", "white", "rgb(255,255,255)"]);

function normColour(v) {
  return String(v).trim().toLowerCase().replace(/\s+/g, "");
}

/** [r, g, b] for #rgb, #rrggbb, rgb()/rgba() and the names white / black; null otherwise. */
export function parseRgb(v) {
  const c = normColour(v);
  if (NAMED_WHITE.has(c)) return [255, 255, 255];
  if (c === "black") return [0, 0, 0];
  let m = c.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  if ((m = c.match(/^#([0-9a-f]{3})$/))) return [...m[1]].map((h) => parseInt(h + h, 16));
  if ((m = c.match(/^rgba?\((\d+),(\d+),(\d+)/))) return m.slice(1, 4).map(Number);
  return null;
}

export function isNearWhite(v) {
  const rgb = parseRgb(v);
  return !!rgb && rgb.every((x) => x >= 235);
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function viewBoxOf(svg) {
  const vb = svg.match(/<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (vb) {
    const [x, y, w, h] = vb[1].trim().split(/[\s,]+/).map(Number);
    if ([x, y, w, h].every(Number.isFinite)) return { x, y, w, h };
  }
  const w = Number(svg.match(/<svg\b[^>]*\bwidth\s*=\s*["']([\d.]+)/i)?.[1]);
  const h = Number(svg.match(/<svg\b[^>]*\bheight\s*=\s*["']([\d.]+)/i)?.[1]);
  return Number.isFinite(w) && Number.isFinite(h) ? { x: 0, y: 0, w, h } : null;
}

/** True when a <rect> or <path> element paints the whole canvas (a background plate). */
export function coversCanvas(tag, box) {
  if (!box) return false;
  const attr = (name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
  const near = (a, b) => Math.abs(a - b) <= Math.max(1, b * 0.01);
  if (/^<rect\b/i.test(tag)) {
    const w = attr("width"), h = attr("height");
    const full = (v, size) => v === "100%" || near(Number(v), size);
    return full(w, box.w) && full(h, box.h) && near(Number(attr("x") ?? 0), box.x) && near(Number(attr("y") ?? 0), box.y);
  }
  const d = attr("d");
  if (!d) return false;
  // Only absolute M/L/Z paths are read as x,y pairs; anything else (H, V, curves,
  // relative commands) is left alone. A white plate missed here still becomes the
  // transparent knockout in mono mode, so being conservative costs nothing.
  const commands = d.replace(/\d[eE]-?\d/g, "0").match(/[a-zA-Z]/g) || [];
  if (commands.some((c) => !"MLZ".includes(c))) return false;
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  if (nums.length < 4 || nums.length % 2) return false;
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  return near(Math.min(...xs), box.x) && near(Math.min(...ys), box.y) &&
    near(Math.max(...xs), box.x + box.w) && near(Math.max(...ys), box.y + box.h);
}

/**
 * Make a Recraft SVG safe to ship and consistent with Lucide usage:
 * strips scripts, event handlers, foreignObject, external references and
 * metadata; drops width/height (viewBox kept) so CSS sizes it; optionally
 * removes a full-canvas background plate; in mono mode turns every painted
 * colour into currentColor and near-white knockouts into a CSS variable.
 */
export function cleanSvg(input, { mono = true, dropBackground = true } = {}) {
  let svg = String(input);
  if (!/<svg\b/i.test(svg)) throw new Error("input is not an SVG document");
  const report = { removedBackground: false, colours: new Set(), knockouts: 0 };

  svg = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|foreignObject|metadata|title|desc)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|foreignObject)\b[^>]*\/>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none");

  const box = viewBoxOf(svg);
  svg = svg.replace(/<svg\b[^>]*>/i, (open) => {
    let tag = open.replace(/\s+(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    if (box && !/\bviewBox\s*=/i.test(tag)) tag = tag.replace(/<svg\b/i, `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}"`);
    if (!/\bxmlns\s*=/i.test(tag)) tag = tag.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return tag;
  });

  if (dropBackground && box) {
    let dropped = false;
    svg = svg.replace(/<(rect|path)\b[^>]*?(\/>|>\s*<\/\1>)/gi, (tag) => {
      if (dropped || !coversCanvas(tag, box)) return tag;
      dropped = true;
      return "";
    });
    report.removedBackground = dropped;
  }

  if (mono) {
    // One-colour icons are rebuilt as a luminance mask: dark paint becomes
    // white (drawn), near-white paint becomes black (cut out), in the original
    // stacking order, then a single currentColor rect is shown through it. A
    // white detail drawn over a dark shape therefore stays a real hole, and
    // IconWell's colour applies exactly as it does to a Lucide glyph.
    const toMask = (v) => {
      const c = normColour(v);
      if (c === "none" || c === "transparent" || c.startsWith("url(") || c.startsWith("var(")) return v;
      if (c === "currentcolor") return "#fff";
      const rgb = parseRgb(c);
      if (!rgb) return "#fff";
      report.colours.add(c);
      if (isNearWhite(c)) report.knockouts++;
      const g = Math.round(255 - (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]));
      return `#${g.toString(16).padStart(2, "0").repeat(3)}`;
    };
    const parts = svg.match(/^([\s\S]*?<svg\b[^>]*>)([\s\S]*)(<\/svg>\s*)$/i);
    if (!parts || !box) throw new Error("mono mode needs a well-formed <svg> with a viewBox or width/height");
    const inner = parts[2]
      .replace(/\b(fill|stroke|stop-color|color)\s*=\s*(["'])([^"']*)\2/gi, (_, a, q, v) => `${a}=${q}${toMask(v)}${q}`)
      .replace(/\b(fill|stroke|stop-color|color)\s*:\s*([^;"']+)/gi, (_, a, v) => `${a}:${toMask(v)}`);
    const id = `de-icon-${hash(inner)}`;
    const area = `x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"`;
    const open = parts[1].replace(/\s+fill\s*=\s*("[^"]*"|'[^']*')/i, "");
    svg = `${open}<defs><mask id="${id}" maskUnits="userSpaceOnUse" ${area}><g fill="#fff">${inner}</g></mask></defs>` +
      `<rect ${area} fill="currentColor" mask="url(#${id})"/></svg>`;
  }

  svg = svg.replace(/>\s+</g, "><").trim() + "\n";
  return { svg, report: { ...report, colours: [...report.colours] } };
}

// ---------------------------------------------------------------- review sheet

export function reviewSheetHtml(items, title) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cell = (it) => `
    <figure>
      <div class="row">
        <span class="well dark">${it.svg}</span>
        <span class="well light">${it.svg}</span>
        <span class="big">${it.svg}</span>
      </div>
      <figcaption>${esc(it.file)}</figcaption>
    </figure>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body{margin:0;padding:24px;background:#050312;color:#F7F5F2;font:14px/1.4 Inter,system-ui,sans-serif}
  h1{font:600 18px "Space Grotesk",Inter,sans-serif;margin:0 0 4px}
  p{margin:0 0 20px;color:#b8b4c4}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
  figure{margin:0;padding:16px;border:1px solid #2a2635;border-radius:16px;background:#0d0b16}
  .row{display:flex;align-items:center;gap:16px}
  .well{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;border:1px solid}
  .well svg{width:20px;height:20px}
  .dark{background:#0a0a0a;border-color:#2a2635;color:#FF4F9A}
  .light{background:#fff;border-color:#e6e2dc;color:#B00F58}
  .big{display:inline-flex;color:#F7F5F2}.big svg{width:96px;height:96px}
  figcaption{margin-top:10px;font-size:12px;color:#8d889c;word-break:break-all}
</style></head><body>
<h1>${esc(title)}</h1>
<p>ILLUSTRATIVE candidates. 20px in a dark and a light IconWell (approximate DE tones), then 96px. Approve per design/IMAGERY.md before use.</p>
<div class="grid">${items.map(cell).join("")}</div>
</body></html>
`;
}

// ---------------------------------------------------------------- HTTP

async function api(pathname, { key, method = "GET", json, form } = {}) {
  const headers = { Authorization: `Bearer ${key}` };
  let body;
  if (json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) body = form;
  const res = await fetch(`${API_BASE}${pathname}`, { method, headers, body });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error?.message || data?.code || data?.raw || res.statusText;
    throw new Error(`Recraft ${method} ${pathname} failed: HTTP ${res.status} ${msg}`);
  }
  return data;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------- commands

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) args._.push(a);
    else if (["--dry-run", "--keep-colour", "--keep-background"].includes(a)) args[a.slice(2)] = true;
    else args[a.slice(2)] = argv[++i];
  }
  return args;
}

function requireKey() {
  const key = loadApiKey();
  if (!key) {
    console.error(`ERROR: no Recraft key. Set ${KEY_NAME} in the environment or the gitignored project-root .env.`);
    process.exit(1);
  }
  return key;
}

async function cmdCheck() {
  const me = await api("/users/me", { key: requireKey() });
  console.log(JSON.stringify({ ok: true, credits: me.credits ?? null }, null, 2));
}

async function cmdGenerate(args) {
  const spec = loadSpec(args.spec || DEFAULT_SPEC);
  const styleId = args["style-id"] || (args.style ? JSON.parse(readFileSync(args.style, "utf8")).style_id : undefined);
  const payload = buildGenerationPayload(spec, { subject: args.subject, n: args.n, styleId, model: args.model });
  const name = slugify(args.name || args.subject);
  const set = slugify(args.set || "misc");
  const dir = path.join(repoRoot(), "artifacts", "recraft", "icons", set);
  // Never overwrite earlier candidates: a repeat run on the same day gets -r2, -r3, ...
  const base = `${today()}-${name}`;
  let stem = base;
  for (let k = 2; existsSync(path.join(dir, `${stem}.svg`)) || existsSync(path.join(dir, `${stem}-1.svg`)); k++) stem = `${base}-r${k}`;

  if (args["dry-run"]) {
    console.log(JSON.stringify({ dryRun: true, endpoint: `${API_BASE}/images/generations`, outDir: path.relative(repoRoot(), dir), stem, payload }, null, 2));
    return;
  }

  const key = requireKey();
  let result;
  let fallback = null;
  try {
    result = await api("/images/generations", { key, method: "POST", json: payload });
  } catch (err) {
    // Not every model accepts every optional field; a rejected request is not
    // charged, so retry once with the optional fields removed and record it.
    if (!/HTTP (400|422)/.test(err.message)) throw err;
    const { negative_prompt, ...rest } = payload;
    const controls = rest.controls ? { ...rest.controls } : undefined;
    if (controls) delete controls.no_text;
    const minimal = { ...rest, ...(controls ? { controls } : {}) };
    fallback = { reason: err.message, dropped: ["negative_prompt", "controls.no_text"] };
    console.error(`note: retrying without optional fields (${err.message})`);
    result = await api("/images/generations", { key, method: "POST", json: minimal });
  }
  const images = result.data || (result.image ? [result.image] : []);
  if (!images.length) throw new Error("Recraft returned no images");
  mkdirSync(dir, { recursive: true });

  const written = [];
  for (const [i, img] of images.entries()) {
    const suffix = images.length > 1 ? `-${i + 1}` : "";
    const raw = (await download(img.url)).toString("utf8");
    // Keep the paid original even if it turns out not to be an SVG.
    writeFileSync(path.join(dir, `${stem}${suffix}.raw.svg`), raw);
    if (!/<svg\b/i.test(raw)) throw new Error(`${stem}${suffix}: Recraft returned a non-SVG file (is the model a vector model?); kept as .raw.svg`);
    const { svg, report } = cleanSvg(raw, {
      mono: spec.post?.mono !== false && !args["keep-colour"],
      dropBackground: spec.post?.drop_full_canvas_background !== false && !args["keep-background"],
    });
    const file = path.join(dir, `${stem}${suffix}.svg`);
    writeFileSync(file, svg);
    writeFileSync(`${file}.manifest.json`, JSON.stringify({
      tool: "recraft-icons", spec: spec.name, model: payload.model, style_id: result.style_id || payload.style_id || null,
      image_id: img.image_id || null, subject: args.subject, prompt: payload.prompt, created: new Date().toISOString(),
      credits_charged: result.credits ?? null, request_fallback: fallback, cleaner: report,
      classification: "ILLUSTRATIVE", approval: "candidate",
      review: "design/IMAGERY.md; compare against Lucide in IconWell at 20px before use",
    }, null, 2) + "\n");
    written.push({ file: path.relative(repoRoot(), file), svg });
  }

  // The sheet shows every cleaned icon in the set, so earlier candidates stay comparable.
  const sheet = path.join(dir, "review.html");
  const all = readdirSync(dir)
    .filter((f) => f.endsWith(".svg") && !f.endsWith(".raw.svg"))
    .sort()
    .map((f) => ({ file: path.relative(repoRoot(), path.join(dir, f)), svg: readFileSync(path.join(dir, f), "utf8") }));
  writeFileSync(sheet, reviewSheetHtml(all, `Recraft icons: ${set}`));
  console.log(JSON.stringify({ ok: true, credits_charged: result.credits ?? null, files: written.map((w) => w.file), review: path.relative(repoRoot(), sheet) }, null, 2));
}

async function cmdCreateStyle(args) {
  const files = args._.slice(1);
  if (files.length < 1 || files.length > 5) throw new Error("create-style takes 1 to 5 reference images");
  for (const f of files) {
    if (!/\.(png|jpe?g|webp)$/i.test(f)) throw new Error(`${f}: references must be PNG, JPEG or WebP (rasterise SVGs first)`);
    if (!existsSync(f)) throw new Error(`${f}: not found`);
  }
  const name = slugify(args.name || "de-icon-style");
  const out = path.join(repoRoot(), "artifacts", "recraft", "styles", `${name}.json`);
  if (args["dry-run"]) {
    console.log(JSON.stringify({ dryRun: true, endpoint: `${API_BASE}/styles`, style: "vector_illustration", model: "recraftv4_styles_vector", files, out: path.relative(repoRoot(), out) }, null, 2));
    return;
  }
  const form = new FormData();
  form.append("style", "vector_illustration");
  form.append("model", "recraftv4_styles_vector");
  files.forEach((f, i) => form.append(`file${i + 1}`, new Blob([readFileSync(f)]), path.basename(f)));
  const res = await api("/styles", { key: requireKey(), method: "POST", form });
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ name, style_id: res.id, model: "recraftv4_styles_vector", references: files, created: new Date().toISOString() }, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, style_id: res.id, saved: path.relative(repoRoot(), out) }, null, 2));
}

function cmdClean(args) {
  const input = args._[1];
  if (!input) throw new Error("clean needs an input .svg");
  const { svg, report } = cleanSvg(readFileSync(input, "utf8"), { mono: !args["keep-colour"], dropBackground: !args["keep-background"] });
  const out = args.out || input.replace(/\.svg$/i, ".clean.svg");
  writeFileSync(out, svg);
  console.log(JSON.stringify({ ok: true, out, report }, null, 2));
}

export async function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  if (cmd === "check") return cmdCheck();
  if (cmd === "generate") return cmdGenerate(args);
  if (cmd === "create-style") return cmdCreateStyle(args);
  if (cmd === "clean") return cmdClean(args);
  console.error("usage: recraft.mjs check | generate --subject <text> --name <slug> [--set <set>] [--n 2] [--style-id <uuid>|--style <file>] [--dry-run] | create-style --name <slug> <refs...> [--dry-run] | clean <in.svg> [--out <file>]");
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  });
}
