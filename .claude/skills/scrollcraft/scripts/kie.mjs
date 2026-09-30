#!/usr/bin/env node
/**
 * scrollcraft asset generator: kie.ai unified jobs API.
 *
 *   POST https://api.kie.ai/api/v1/jobs/createTask   { model, input }
 *   GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
 *   GET  https://api.kie.ai/api/v1/chat/credit
 *
 * SPEND RULES (Joe, 2026-09-02; docs/kie/KIE-RULES.md). This script enforces
 * the ones a script can enforce:
 *
 *   - Image models only. `shot` (video) refuses unless KIE_ALLOW_VIDEO=1 is
 *     set, which only Joe's written instruction may do.
 *   - Every paid call needs --approved "<who, when>" AND --cap <credits>.
 *     Without both it refuses before any network call.
 *   - The credit balance is read before and after. The call refuses when the
 *     model's listed price exceeds --cap, or the balance cannot cover it.
 *   - Exactly one createTask per invocation. Never a retry. A failed task is
 *     recorded and the script exits 1; a retry needs Joe's approval again.
 *   - --dry-run prints the exact request (prompt included) and exits without
 *     touching the network. Use it to show Joe what would be generated.
 *   - Every generated file gets a provenance entry in
 *     <asset dir>/manifest.json: model, prompt, refs, taskId, result URLs,
 *     hash, credits before/after/spent, cap, approval, classification
 *     ILLUSTRATIVE, status "candidate". Nothing here publishes anything.
 *
 * COMMANDS
 *   probe                       account credit, read-only
 *   models                      print the image-model registry, no network
 *   still  <prompt|@file> <out.png> --approved "..." --cap N
 *          [--model <id>] [--ar 16:9] [--ref a.png ...] [--family F-02]
 *          [--frame environment-01] [--page "homepage / peak"] [--dry-run]
 *          Text-to-image, or image-to-image when --ref is given (the model's
 *          edit variant is used; refs are uploaded or passed through as URLs).
 *   shot   <prompt> <in.png> <out.mp4> [--tail b.png] [--dur 5] + the same
 *          --approved/--cap flags. GATED: see KIE_ALLOW_VIDEO above.
 *
 * Env: KIE_AI_API_KEY (canonical). KIE_API_KEY is accepted as an alias. Either
 * may live in the project-root .env instead of the environment.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const API = "https://api.kie.ai";
const UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";

// --------------------------------------------------------- model registry ----
// Order = Joe's preference (2026-09-02). `credits` is the price listed on
// kie.ai when the registry was written; it is a pre-check only, the manifest
// records the actual debit. `availability` is filled from the read-only probe
// (docs/kie/AVAIL-*.md): "available", "not-authorized", or "unprobed".
// Input builders follow docs.kie.ai/market/<model>; a field the API rejects
// comes back as a validation error (no task, no charge), never as a spend.
const NEGATIVE = "people, faces, text, watermark, logo, padlock, shield, hologram, data stream, dashboard, neon, cyberpunk, blur, distortion";

export const IMAGE_MODELS = [
  {
    id: "gpt-image-2-text-to-image", name: "GPT Image 2", edit: "gpt-image-2-image-to-image",
    credits: 9, availability: "unprobed", docs: "https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar }),
    editInput: ({ prompt, ar, urls }) => ({ prompt, aspect_ratio: ar, image_urls: urls }),
  },
  {
    id: "nano-banana-2", name: "Nano Banana 2", edit: "nano-banana-2",
    credits: 8, availability: "unprobed", docs: "https://docs.kie.ai/market/google/nanobanana2",
    input: ({ prompt, ar }) => ({ prompt, image_input: [], aspect_ratio: ar, resolution: "1K", output_format: "png" }),
    editInput: ({ prompt, ar, urls }) => ({ prompt, image_input: urls, aspect_ratio: ar, resolution: "1K", output_format: "png" }),
  },
  {
    id: "google/imagen4-ultra", name: "Imagen 4 Ultra", edit: null,
    credits: null, availability: "unprobed", docs: "https://docs.kie.ai/market/google/imagen4-ultra",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar, negative_prompt: NEGATIVE }),
  },
  {
    id: "google/imagen4-fast", name: "Imagen 4 Fast", edit: null,
    credits: null, availability: "unprobed", docs: "https://docs.kie.ai/market/google/imagen4",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar, negative_prompt: NEGATIVE }),
  },
  {
    id: "flux-2/pro-text-to-image", name: "Flux-2 Pro", edit: "flux-2/pro-image-to-image",
    credits: 5, availability: "unprobed", docs: "https://docs.kie.ai/market/flux2/pro-text-to-image",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar, resolution: "1K" }),
    editInput: ({ prompt, ar, urls }) => ({ prompt, aspect_ratio: ar, resolution: "1K", input_urls: urls }),
  },
  {
    id: "seedream/5-pro-text-to-image", name: "Seedream 5 Pro", edit: "seedream/5-pro-image-to-image",
    credits: 28, availability: "not-authorized (2026-09-02, API code 401)", docs: "https://docs.kie.ai/market/seedream/5-pro-text-to-image",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar, quality: "high", output_format: "png", nsfw_checker: false }),
    editInput: ({ prompt, ar, urls }) => ({ prompt, aspect_ratio: ar, quality: "high", output_format: "png", nsfw_checker: false, image_urls: urls }),
  },
];

const VIDEO_MODEL = "kling/v2-1-pro";

// ---------------------------------------------------------------- key ----
// KIE_AI_API_KEY is the canonical name; KIE_API_KEY is accepted because the
// Windows setup script Joe ran locally (setup-kie.ps1) exports that name.
const KEY_NAMES = ["KIE_AI_API_KEY", "KIE_API_KEY"];
function findEnv(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    const p = path.join(dir, ".env");
    if (fs.existsSync(p)) return p;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
function loadKey() {
  for (const name of KEY_NAMES) if (process.env[name]) return process.env[name];
  const envPath = findEnv(process.cwd());
  if (!envPath) throw new Error("KIE_AI_API_KEY (or KIE_API_KEY) not set and no .env found walking up from " + process.cwd());
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:KIE_AI_API_KEY|KIE_API_KEY)\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("KIE_AI_API_KEY (or KIE_API_KEY) not found in " + envPath);
}

let KEY = null;
let H = null;
function auth() {
  if (!KEY) { KEY = loadKey(); H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }; }
  return H;
}

// ------------------------------------------------------------- helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

async function apiJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { code: res.status, msg: text.slice(0, 300) }; }
}

async function credit() {
  const r = await fetch(`${API}/api/v1/chat/credit`, { headers: auth() });
  const j = await apiJson(r);
  if (j.code !== 200) throw new Error(`credit endpoint: ${JSON.stringify(j)}`);
  return Number(j.data);
}

async function uploadLocal(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error("input not found: " + abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const dataUrl = `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`;
  const res = await fetch(UPLOAD, {
    method: "POST", headers: auth(),
    body: JSON.stringify({ base64Data: dataUrl, uploadPath: "scrollcraft", fileName: path.basename(abs) }),
  });
  const j = await apiJson(res);
  const url = j?.data?.downloadUrl || j?.data?.fileUrl || j?.data?.url;
  if (!url) throw new Error("upload failed: " + JSON.stringify(j));
  return url;
}

// A local path becomes a hosted URL; an http(s) string passes straight through.
const asUrl = (v) => (/^https?:\/\//i.test(v) ? Promise.resolve(v) : uploadLocal(v));

async function createTask(model, input) {
  const res = await fetch(`${API}/api/v1/jobs/createTask`, {
    method: "POST", headers: auth(), body: JSON.stringify({ model, input }),
  });
  const j = await apiJson(res);
  if (j.code !== 200 || !j?.data?.taskId) throw new Error(`createTask ${model}: ${JSON.stringify(j)}`);
  return j.data.taskId;
}

async function waitTask(taskId, { label = "job", timeoutMs = 15 * 60 * 1000 } = {}) {
  const t0 = Date.now();
  let delay = 4000;
  for (;;) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`${label}: timed out after ${Math.round((Date.now() - t0) / 1000)}s`);
    const res = await fetch(`${API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: auth() });
    const j = await apiJson(res);
    const d = j?.data || {};
    const state = d.state || d.status;
    if (state === "success") {
      let out = d.resultJson;
      if (typeof out === "string") { try { out = JSON.parse(out); } catch {} }
      const urls = out?.resultUrls || out?.result_urls || out?.urls || [];
      if (!urls.length) throw new Error(`${label}: success with no result url: ${JSON.stringify(d)}`);
      return { urls, record: { costTime: d.costTime, createTime: d.createTime, completeTime: d.completeTime } };
    }
    if (state === "fail" || state === "failed") {
      throw new Error(`${label} failed: ${d.failMsg || d.failCode || JSON.stringify(d)}`);
    }
    process.stderr.write(`  ${label}: ${state || "queued"} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
    await sleep(delay);
    delay = Math.min(delay * 1.25, 15000);
  }
}

async function download(url, out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.resolve(out), buf);
  return { bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

function flag(argv, name, dflt = null) {
  const i = argv.indexOf(name);
  return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
}
function flags(argv, name) {
  const out = [];
  argv.forEach((a, i) => { if (a === name && argv[i + 1]) out.push(argv[i + 1]); });
  return out;
}
const has = (argv, name) => argv.includes(name);

// A prompt argument of the form @path reads the file (trimmed), so long
// prompts live beside the asset and are committed verbatim.
function readPrompt(arg) {
  if (arg && arg.startsWith("@")) return fs.readFileSync(path.resolve(arg.slice(1)), "utf8").trim();
  return arg;
}

// ------------------------------------------------------------- manifest ----
// One manifest per asset directory, an array of entries. An entry is written
// as soon as a task exists (status "submitted"), then updated on completion,
// so a taskId or result URL is never lost to a failed download.
function manifestPath(out) { return path.join(path.dirname(path.resolve(out)), "manifest.json"); }
function readManifest(out) {
  const p = manifestPath(out);
  if (!fs.existsSync(p)) return [];
  try { const j = JSON.parse(fs.readFileSync(p, "utf8")); return Array.isArray(j) ? j : []; } catch { return []; }
}
function upsertManifest(out, entry) {
  const p = manifestPath(out);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const list = readManifest(out);
  const i = list.findIndex((e) => e.taskId && e.taskId === entry.taskId);
  if (i > -1) list[i] = { ...list[i], ...entry }; else list.push(entry);
  fs.writeFileSync(p, JSON.stringify(list, null, 2) + "\n");
  return p;
}

// ---------------------------------------------------------- spend guard ----
// Refuses before any network call unless Joe's approval and a cap are given.
function requireApproval(argv) {
  const approved = flag(argv, "--approved");
  const capRaw = flag(argv, "--cap");
  const cap = Number(capRaw);
  const problems = [];
  if (!approved) problems.push('--approved "<who, when>" is required: Joe must approve each paid generation in the same message');
  if (!capRaw || !Number.isFinite(cap) || cap <= 0) problems.push("--cap <credits> is required: the spend cap Joe gave for this call");
  if (problems.length) throw new Error("refused, nothing sent:\n  - " + problems.join("\n  - "));
  return { approved, cap };
}

async function preflightSpend(model, cap) {
  const listed = model.credits;
  // Price against cap first, so a refusal needs no network at all.
  if (listed != null && listed > cap) {
    throw new Error(`refused, nothing sent: ${model.name} lists ${listed} credits per image, above the cap of ${cap}.`);
  }
  const before = await credit();
  const need = listed != null ? listed : cap;
  if (before < need) {
    throw new Error(`refused, nothing sent: balance ${before} credits cannot cover ${need}. Never top up automatically; ask Joe.`);
  }
  return before;
}

function pickModel(argv) {
  const id = flag(argv, "--model", IMAGE_MODELS[0].id);
  const m = IMAGE_MODELS.find((x) => x.id === id || x.name.toLowerCase() === String(id).toLowerCase());
  if (!m) throw new Error(`unknown model "${id}". Known: ${IMAGE_MODELS.map((x) => x.id).join(", ")}`);
  if (String(m.availability).startsWith("not-authorized")) {
    throw new Error(`refused, nothing sent: ${m.name} (${m.id}) is marked ${m.availability}. Pick another --model or re-probe.`);
  }
  return m;
}

// ---------------------------------------------------------------- main ----
const [cmd, ...rest] = process.argv.slice(2);

try {
  if (cmd === "probe") {
    const bal = await credit();
    console.log("credit:", bal);

  } else if (cmd === "models") {
    for (const m of IMAGE_MODELS) {
      console.log(`${m.id.padEnd(30)} ${m.name.padEnd(16)} ${String(m.credits ?? "?").padStart(3)} credits  ${m.availability}${m.edit ? "  edit: " + m.edit : ""}`);
    }
    console.log(`\nvideo (${VIDEO_MODEL}): gated, KIE_ALLOW_VIDEO=1 required, Joe's instruction only`);

  } else if (cmd === "still") {
    const [promptArg, out] = rest;
    if (!promptArg || !out) throw new Error('usage: kie.mjs still "<prompt>|@file" <out.png> --approved "..." --cap N [--model id] [--ar 16:9] [--ref a.png] [--dry-run]');
    const prompt = readPrompt(promptArg);
    const ar = flag(rest, "--ar", "16:9");
    const refs = flags(rest, "--ref");
    const model = pickModel(rest);
    const dry = has(rest, "--dry-run");
    let modelId = model.id;
    let input;
    if (refs.length) {
      if (!model.edit || !model.editInput) throw new Error(`${model.name} has no image-to-image variant in the registry`);
      modelId = model.edit;
      input = model.editInput({ prompt, ar, urls: dry ? refs : await Promise.all(refs.map(asUrl)) });
    } else {
      input = model.input({ prompt, ar });
    }
    const family = flag(rest, "--family", path.basename(path.dirname(path.resolve(out))).toUpperCase());
    const frame = flag(rest, "--frame", path.basename(out, path.extname(out)));
    const page = flag(rest, "--page", "");

    if (dry) {
      console.log(JSON.stringify({
        dryRun: true, wouldSend: { url: `${API}/api/v1/jobs/createTask`, body: { model: modelId, input } },
        listedCredits: model.credits, availability: model.availability, out: path.resolve(out),
        manifest: manifestPath(out), family, frame, page,
        note: "nothing was sent; a real run also needs --approved and --cap",
      }, null, 2));
      process.exit(0);
    }

    const { approved, cap } = requireApproval(rest);
    const before = await preflightSpend(model, cap);
    process.stderr.write(`  balance ${before} credits, cap ${cap}, model ${modelId}${model.credits != null ? ` (lists ${model.credits})` : ""}\n`);

    // Exactly one createTask. No retry on any failure after this line.
    const taskId = await createTask(modelId, input);
    const entryBase = {
      family, frame, page, provider: "kie.ai", model: modelId, prompt, refs, aspect: ar,
      taskId, submittedAt: now(), approvedBy: approved, cap, creditsBefore: before,
      classification: "ILLUSTRATIVE", status: "submitted", usage: [],
      license: "DE-generated under kie.ai commercial terms (Joe confirms the provider terms once)",
    };
    upsertManifest(out, entryBase);
    process.stderr.write(`  task ${taskId} recorded in ${manifestPath(out)}\n`);

    let urls, record;
    try {
      ({ urls, record } = await waitTask(taskId, { label: path.basename(out) }));
    } catch (err) {
      const after = await credit().catch(() => null);
      upsertManifest(out, { taskId, status: "failed", failedAt: now(), error: err.message, creditsAfter: after, creditsSpent: after == null ? null : before - after });
      throw new Error(`${err.message}\n  recorded as failed; no retry (Joe's rule 4). Balance now ${after ?? "unknown"}.`);
    }
    const after = await credit();
    const spent = before - after;
    upsertManifest(out, { taskId, status: "generated", completedAt: now(), resultUrls: urls, kie: record, creditsAfter: after, creditsSpent: spent, capExceeded: spent > cap });
    if (spent > cap) process.stderr.write(`  WARNING: spent ${spent} credits, above the cap of ${cap}. Reported in the manifest; tell Joe.\n`);

    const file = await download(urls[0], out);
    upsertManifest(out, { taskId, status: "candidate", file: path.relative(process.cwd(), path.resolve(out)), sha256: file.sha256, bytes: file.bytes });
    process.stderr.write(`  spent ${spent} credits (balance ${after}); candidate, not published\n`);
    console.log(out);

  } else if (cmd === "shot") {
    if (process.env.KIE_ALLOW_VIDEO !== "1") {
      throw new Error("refused, nothing sent: video generation is not authorized (Joe, 2026-09-02: image models only). KIE_ALLOW_VIDEO=1 may be set only on Joe's written instruction.");
    }
    const [prompt, head, out] = rest;
    if (!prompt || !head || !out) {
      throw new Error('usage: kie.mjs shot "<prompt>" <head.png> <out.mp4> --approved "..." --cap N [--tail b.png] [--dur 5]');
    }
    const { approved, cap } = requireApproval(rest);
    const dur = flag(rest, "--dur", "5");
    const tail = flag(rest, "--tail");
    const input = {
      prompt: readPrompt(prompt),
      image_url: await asUrl(head),
      duration: String(dur),
      // Camera-move clips are graded on smoothness, so the negative prompt
      // targets exactly what breaks a scrub: judder, warping, cuts.
      negative_prompt: "blur, distortion, low quality, warping, morphing, jitter, flicker, text, watermark, cut, scene change",
      cfg_scale: 0.5,
    };
    if (tail) input.tail_image_url = await asUrl(tail);
    const before = await preflightSpend({ name: VIDEO_MODEL, credits: null }, cap);
    const taskId = await createTask(VIDEO_MODEL, input);
    upsertManifest(out, { provider: "kie.ai", model: VIDEO_MODEL, prompt: input.prompt, head, tail, taskId, submittedAt: now(), approvedBy: approved, cap, creditsBefore: before, classification: "ILLUSTRATIVE", status: "submitted", usage: [] });
    const { urls, record } = await waitTask(taskId, { label: path.basename(out), timeoutMs: 20 * 60 * 1000 });
    const after = await credit();
    upsertManifest(out, { taskId, status: "generated", completedAt: now(), resultUrls: urls, kie: record, creditsAfter: after, creditsSpent: before - after, capExceeded: before - after > cap });
    const file = await download(urls[0], out);
    upsertManifest(out, { taskId, status: "candidate", file: path.relative(process.cwd(), path.resolve(out)), sha256: file.sha256, bytes: file.bytes });
    console.log(out);

  } else {
    console.error(`scrollcraft asset generator (kie.ai) — image models only, approval + cap required

  node kie.mjs probe
  node kie.mjs models
  node kie.mjs still "<prompt>|@prompt.txt" <out.png> --approved "Joe, <date/message>" --cap <credits> [--model <id>] [--ar 16:9] [--ref ref.png] [--dry-run]
  node kie.mjs shot  "<prompt>" <head.png> <out.mp4> --approved "..." --cap N [--tail tail.png] [--dur 5]   (gated: KIE_ALLOW_VIDEO=1)
`);
    process.exit(1);
  }
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
}
