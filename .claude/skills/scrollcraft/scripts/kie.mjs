#!/usr/bin/env node
/**
 * scrollcraft asset generator: kie.ai unified jobs API, one spend gate for
 * every image model this repository uses.
 *
 *   POST https://api.kie.ai/api/v1/jobs/createTask   { model, input }
 *   GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
 *   GET  https://api.kie.ai/api/v1/chat/credit
 *   Results are downloaded from the host kie.ai returns: seen so far
 *   tempfile.redpandaai.co and tempfile.aiquickdraw.com (google/nano-banana).
 *   Both must be on a cloud environment's allowed-domain list.
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
 *   - A download is accepted only when the response is 2xx and the body is a
 *     PNG, JPEG or WebP; otherwise the task id and result URL are printed so
 *     the paid-for image can be fetched without generating again (the lesson
 *     of PR #185, where a proxy refusal was saved as a ".png" twice).
 *   - Every generated file gets a provenance entry in
 *     <asset dir>/manifest.json: model, prompt, refs, taskId, result URLs,
 *     hash, credits before/after/spent (and kie.ai's own creditsConsumed),
 *     cap, approval, classification ILLUSTRATIVE, status "candidate".
 *     Nothing here publishes anything.
 *
 * COMMANDS
 *   probe                       account credit, read-only
 *   models                      print the image-model registry, no network
 *   still  <prompt|@file> <out.png> --approved "..." --cap N
 *          [--model <id>] [--ar 16:9] [--ref a.png ...] [--family F-02]
 *          [--frame environment-01] [--page "homepage / peak"] [--dry-run]
 *          Text-to-image, or image-to-image when --ref is given (the model's
 *          edit variant is used; refs are uploaded or passed through as URLs).
 *   nb2    <prompt.json> <out.png> --approved "..." --cap N [--ar 16:9]
 *          [--resolution 1K|2K|4K] [--ref a.png ...] [--dry-run] ...
 *          Nano Banana 2 with the nano-banana-images skill's Dense Narrative
 *          JSON prompt file: "image_input" and "api_parameters" are lifted
 *          out, the rest of the object is stringified into input.prompt,
 *          exactly as .claude/skills/nano-banana-images/scripts/generate_kie.py
 *          does, but behind this gate and with the shared manifest.
 *   fetch  <taskId> <out.png>   download an already-paid-for result, no spend
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
// Order = Joe's preference (2026-09-02) with the models the vendored skill
// packs use added where they sit. `credits` is the price listed on kie.ai when
// the registry was written; it is a pre-check only, the manifest records the
// actual debit (creditsSpent from the balance, creditsConsumed from kie.ai).
// `availability` is filled from the read-only probes and real runs.
const NEGATIVE = "people, faces, text, watermark, logo, padlock, shield, hologram, data stream, dashboard, neon, cyberpunk, blur, distortion";

export const IMAGE_MODELS = [
  {
    id: "gpt-image-2-text-to-image", name: "GPT Image 2", edit: "gpt-image-2-image-to-image",
    credits: 9, availability: "name valid (probe 2026-09-02); key authorization unverified", docs: "https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar }),
    editInput: ({ prompt, ar, urls }) => ({ prompt, aspect_ratio: ar, image_urls: urls }),
  },
  {
    id: "nano-banana-2", name: "Nano Banana 2", edit: "nano-banana-2",
    credits: 8, availability: "name valid (probe 2026-09-02); the nano-banana-images skill's model; 1K listed from $0.04, 2K/4K cost more", docs: "https://docs.kie.ai/market/google/nanobanana2",
    input: ({ prompt, ar, resolution = "1K" }) => ({ prompt, image_input: [], aspect_ratio: ar, resolution, output_format: "png" }),
    editInput: ({ prompt, ar, urls, resolution = "1K" }) => ({ prompt, image_input: urls, aspect_ratio: ar, resolution, output_format: "png" }),
  },
  {
    id: "google/nano-banana", name: "Nano Banana (1)", edit: "google/nano-banana",
    credits: 4, availability: "works with this key: two excalidraw-visuals runs on 2026-09-02 (PR #185); result host tempfile.aiquickdraw.com", docs: "https://docs.kie.ai/market/google/nano-banana",
    input: ({ prompt, ar }) => ({ prompt, output_format: "png", image_size: ar }),
    editInput: ({ prompt, ar, urls }) => ({ prompt, output_format: "png", image_size: ar, image_input: urls }),
  },
  {
    id: "google/imagen4-ultra", name: "Imagen 4 Ultra", edit: null,
    credits: null, availability: "name valid (probe 2026-09-02); price not listed", docs: "https://docs.kie.ai/market/google/imagen4-ultra",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar, negative_prompt: NEGATIVE }),
  },
  {
    id: "google/imagen4-fast", name: "Imagen 4 Fast", edit: null,
    credits: null, availability: "name valid (probe 2026-09-02); price not listed", docs: "https://docs.kie.ai/market/google/imagen4",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar, negative_prompt: NEGATIVE }),
  },
  {
    id: "flux-2/pro-text-to-image", name: "Flux-2 Pro", edit: "flux-2/pro-image-to-image",
    credits: 5, availability: "name valid (probe 2026-09-02)", docs: "https://docs.kie.ai/market/flux2/pro-text-to-image",
    input: ({ prompt, ar }) => ({ prompt, aspect_ratio: ar, resolution: "1K" }),
    editInput: ({ prompt, ar, urls }) => ({ prompt, aspect_ratio: ar, resolution: "1K", input_urls: urls }),
  },
  {
    id: "seedream/5-pro-text-to-image", name: "Seedream 5 Pro", edit: "seedream/5-pro-image-to-image",
    credits: 28, availability: "not-authorized (2026-09-02, API code 401 on a full request)", docs: "https://docs.kie.ai/market/seedream/5-pro-text-to-image",
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

function parseRecord(d) {
  let out = d.resultJson;
  if (typeof out === "string") { try { out = JSON.parse(out); } catch {} }
  const urls = out?.resultUrls || out?.result_urls || out?.urls || [];
  return { urls, record: { costTime: d.costTime, createTime: d.createTime, completeTime: d.completeTime, creditsConsumed: d.creditsConsumed ?? null } };
}

async function waitTask(taskId, { label = "job", timeoutMs = 15 * 60 * 1000 } = {}) {
  const t0 = Date.now();
  let delay = 4000;
  for (;;) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`${label}: timed out after ${Math.round((Date.now() - t0) / 1000)}s; recover later with: kie.mjs fetch ${taskId} <out>`);
    const res = await fetch(`${API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: auth() });
    const j = await apiJson(res);
    const d = j?.data || {};
    const state = d.state || d.status;
    if (state === "success" || state === "completed") {
      const parsed = parseRecord(d);
      if (!parsed.urls.length) throw new Error(`${label}: success with no result url: ${JSON.stringify(d)}`);
      return parsed;
    }
    if (state === "fail" || state === "failed" || state === "error") {
      throw new Error(`${label} failed: ${d.failMsg || d.failCode || JSON.stringify(d)}`);
    }
    process.stderr.write(`  ${label}: ${state || "queued"} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
    await sleep(delay);
    delay = Math.min(delay * 1.25, 15000);
  }
}

// Only a real image is saved. A proxy refusal, an expired link or a login page
// is rejected, and the caller prints the task id and URL for a free re-fetch.
function isImageBuffer(buf) {
  if (buf.length < 12) return false;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const webp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  return png || jpeg || webp;
}

async function download(url, out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`download HTTP ${res.status} from ${new URL(url).host}: ${buf.toString("utf8").slice(0, 200).trim()}`);
  if (!isImageBuffer(buf)) throw new Error(`download from ${new URL(url).host} is not an image (${buf.length} bytes): ${buf.toString("utf8").slice(0, 200).trim()}`);
  fs.writeFileSync(path.resolve(out), buf);
  return { bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

function recoveryNote(taskId, urls) {
  return `The image exists on kie.ai and the credits are spent; nothing was retried.\n  task id:    ${taskId}\n  result url: ${urls?.[0] || "(none)"}\n  re-fetch without paying: node kie.mjs fetch ${taskId} <out.png>\n  if the message names a host not in the allowlist, add that host to the cloud environment's allowed domains.`;
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

function pickModel(argv, dflt = IMAGE_MODELS[0].id) {
  const id = flag(argv, "--model", dflt);
  const m = IMAGE_MODELS.find((x) => x.id === id || x.name.toLowerCase() === String(id).toLowerCase());
  if (!m) throw new Error(`unknown model "${id}". Known: ${IMAGE_MODELS.map((x) => x.id).join(", ")}`);
  if (String(m.availability).startsWith("not-authorized")) {
    throw new Error(`refused, nothing sent: ${m.name} (${m.id}) is marked ${m.availability}. Pick another --model or re-probe.`);
  }
  return m;
}

function assetMeta(rest, out) {
  return {
    family: flag(rest, "--family", path.basename(path.dirname(path.resolve(out))).toUpperCase()),
    frame: flag(rest, "--frame", path.basename(out, path.extname(out))),
    page: flag(rest, "--page", ""),
  };
}

// The shared paid path: one createTask, manifest first, poll, balance, download.
async function generateImage({ rest, out, modelId, model, input, extra = {} }) {
  const { approved, cap } = requireApproval(rest);
  const before = await preflightSpend(model, cap);
  process.stderr.write(`  balance ${before} credits, cap ${cap}, model ${modelId}${model.credits != null ? ` (lists ${model.credits})` : ""}\n`);

  // Exactly one createTask. No retry on any failure after this line.
  const taskId = await createTask(modelId, input);
  upsertManifest(out, {
    ...assetMeta(rest, out), provider: "kie.ai", model: modelId, input, ...extra,
    taskId, submittedAt: now(), approvedBy: approved, cap, creditsBefore: before,
    classification: "ILLUSTRATIVE", status: "submitted", usage: [],
    license: "DE-generated under kie.ai commercial terms (Joe confirms the provider terms once)",
  });
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

  let file;
  try {
    file = await download(urls[0], out);
  } catch (err) {
    upsertManifest(out, { taskId, status: "generated-not-downloaded", downloadError: err.message });
    throw new Error(`${err.message}\n${recoveryNote(taskId, urls)}`);
  }
  upsertManifest(out, { taskId, status: "candidate", file: path.relative(process.cwd(), path.resolve(out)), sha256: file.sha256, bytes: file.bytes });
  process.stderr.write(`  spent ${spent} credits (balance ${after}); candidate, not published\n`);
  console.log(out);
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

  } else if (cmd === "fetch") {
    const [taskId, out] = rest;
    if (!taskId || !out) throw new Error("usage: kie.mjs fetch <taskId> <out.png>   (re-downloads a paid-for result, no spend)");
    const res = await fetch(`${API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: auth() });
    const j = await apiJson(res);
    const d = j?.data || {};
    const state = d.state || d.status;
    if (state !== "success" && state !== "completed") throw new Error(`task ${taskId} is ${state || "unknown"}: ${JSON.stringify(d).slice(0, 300)}`);
    const { urls, record } = parseRecord(d);
    if (!urls.length) throw new Error(`task ${taskId}: no result url`);
    const file = await download(urls[0], out);
    upsertManifest(out, { taskId, status: "candidate", resultUrls: urls, kie: record, fetchedAt: now(), file: path.relative(process.cwd(), path.resolve(out)), sha256: file.sha256, bytes: file.bytes, classification: "ILLUSTRATIVE" });
    console.log(out);

  } else if (cmd === "still") {
    const [promptArg, out] = rest;
    if (!promptArg || !out) throw new Error('usage: kie.mjs still "<prompt>|@file" <out.png> --approved "..." --cap N [--model id] [--ar 16:9] [--ref a.png] [--dry-run]');
    const prompt = readPrompt(promptArg);
    const ar = flag(rest, "--ar", "16:9");
    const refs = flags(rest, "--ref");
    const model = pickModel(rest);
    const dry = has(rest, "--dry-run");
    const resolution = flag(rest, "--resolution", "1K");
    let modelId = model.id;
    let input;
    if (refs.length) {
      if (!model.edit || !model.editInput) throw new Error(`${model.name} has no image-to-image variant in the registry`);
      modelId = model.edit;
      input = model.editInput({ prompt, ar, resolution, urls: dry ? refs : await Promise.all(refs.map(asUrl)) });
    } else {
      input = model.input({ prompt, ar, resolution });
    }
    if (dry) {
      console.log(JSON.stringify({
        dryRun: true, wouldSend: { url: `${API}/api/v1/jobs/createTask`, body: { model: modelId, input } },
        listedCredits: model.credits, availability: model.availability, out: path.resolve(out),
        manifest: manifestPath(out), ...assetMeta(rest, out),
        note: "nothing was sent; a real run also needs --approved and --cap",
      }, null, 2));
      process.exit(0);
    }
    await generateImage({ rest, out, modelId, model, input, extra: { prompt, refs, aspect: ar } });

  } else if (cmd === "nb2") {
    // The nano-banana-images skill's Dense Narrative JSON, behind the gate.
    const [promptFile, out] = rest;
    if (!promptFile || !out) throw new Error('usage: kie.mjs nb2 <prompt.json> <out.png> --approved "..." --cap N [--ar 16:9] [--resolution 1K] [--ref a.png] [--dry-run]');
    const promptJson = JSON.parse(fs.readFileSync(path.resolve(promptFile), "utf8"));
    const imageInput = promptJson.image_input; delete promptJson.image_input;
    const api = promptJson.api_parameters || {}; delete promptJson.api_parameters;
    const model = pickModel(rest, "nano-banana-2");
    const dry = has(rest, "--dry-run");
    const refs = flags(rest, "--ref");
    const input = {
      prompt: JSON.stringify(promptJson),
      aspect_ratio: api.aspect_ratio || flag(rest, "--ar", "16:9"),
      resolution: api.resolution || flag(rest, "--resolution", "1K"),
      output_format: api.output_format || "png",
    };
    if (api.google_search !== undefined) input.google_search = api.google_search;
    const urls = [...(Array.isArray(imageInput) ? imageInput : []), ...(dry ? refs : await Promise.all(refs.map(asUrl)))];
    if (urls.length) input.image_input = urls;
    if (dry) {
      console.log(JSON.stringify({
        dryRun: true, wouldSend: { url: `${API}/api/v1/jobs/createTask`, body: { model: model.id, input } },
        listedCredits: model.credits, availability: model.availability, promptFile: path.resolve(promptFile),
        out: path.resolve(out), manifest: manifestPath(out), ...assetMeta(rest, out),
        note: "nothing was sent; a real run also needs --approved and --cap",
      }, null, 2));
      process.exit(0);
    }
    await generateImage({ rest, out, modelId: model.id, model, input, extra: { promptFile: path.relative(process.cwd(), path.resolve(promptFile)), refs: urls, aspect: input.aspect_ratio, resolution: input.resolution } });

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
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    const res = await fetch(urls[0]);
    if (!res.ok) throw new Error(`download HTTP ${res.status}\n${recoveryNote(taskId, urls)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.resolve(out), buf);
    upsertManifest(out, { taskId, status: "candidate", file: path.relative(process.cwd(), path.resolve(out)), sha256: crypto.createHash("sha256").update(buf).digest("hex"), bytes: buf.length });
    console.log(out);

  } else {
    console.error(`scrollcraft asset generator (kie.ai) — image models only, approval + cap required

  node kie.mjs probe
  node kie.mjs models
  node kie.mjs still "<prompt>|@prompt.txt" <out.png> --approved "Joe, <date/message>" --cap <credits> [--model <id>] [--ar 16:9] [--ref ref.png] [--dry-run]
  node kie.mjs nb2   <prompt.json> <out.png> --approved "..." --cap <credits> [--ar 16:9] [--resolution 1K|2K|4K] [--ref ref.png] [--dry-run]
  node kie.mjs fetch <taskId> <out.png>
  node kie.mjs shot  "<prompt>" <head.png> <out.mp4> --approved "..." --cap N [--tail tail.png] [--dur 5]   (gated: KIE_ALLOW_VIDEO=1)
`);
    process.exit(1);
  }
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
}
