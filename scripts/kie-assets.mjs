#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_BASE = 'https://api.kie.ai';
const DEFAULT_OUTPUT_ROOT = 'artifacts/kie-ai';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

const MODEL_PROFILES = {
  image: {
    default: 'gpt-image-2-text-to-image',
    allowed: new Set(['gpt-image-2-text-to-image', 'nano-banana-2']),
  },
  video: {
    default: 'bytedance/seedance-2-5',
    allowed: new Set(['bytedance/seedance-2-5']),
  },
};

const DE_STYLE = [
  'Digerati Experts visual system.',
  'Premium enterprise technology editorial art direction.',
  'Graphite and gunmetal materials, smoked glass, restrained deep-violet illumination used as light rather than paint, controlled studio lighting, sophisticated shadows, realistic or highly refined architectural/product visualization, generous negative space.',
  'Use magenta only as a restrained brand accent when compositionally appropriate; avoid rainbow gradients.',
  'Represent the underlying concept, not a literal noun or stock cybersecurity cliché.',
  'Avoid generic shields, padlocks, laptops as the whole concept, robots, hacker hoodies, generic server racks, binary-code backgrounds, neon cyberpunk grids, excessive glow, toy-like 3D, cartoon styling, random AI objects, fake dashboards, fabricated client data, fabricated telemetry, fabricated metrics, logos of vendors unless explicitly supplied.',
  'Composition must remain usable in responsive website crops and must complement typography rather than compete with it.',
].join(' ');

function usage(exitCode = 0) {
  const text = `\nDigerati Experts — Kie AI asset CLI\n\nUsage:\n  node scripts/kie-assets.mjs credit\n  node scripts/kie-assets.mjs status <taskId>\n  node scripts/kie-assets.mjs create image --prompt \"...\" [options]\n  node scripts/kie-assets.mjs create video --prompt \"...\" [options]\n\nShared create options:\n  --model <id>            Override the approved default model\n  --aspect <ratio>        Image: auto by default; video: 16:9 by default\n  --callback <url>        Optional Kie callback URL\n  --wait                  Poll until complete and download result URLs\n  --out <dir>             Output root (default: ${DEFAULT_OUTPUT_ROOT})\n  --dry-run               Print sanitized request payload; no network call\n\nImage options:\n  --resolution <1K|2K>    Nano Banana 2 only (default: 2K)\n  --format <png|jpg>      Nano Banana 2 only (default: png)\n  --image <url>           Repeatable reference image URL for Nano Banana 2\n\nVideo options (Seedance 2.5):\n  --duration <seconds>    Default: 10\n  --resolution <720p>     Default: 720p\n  --image <url>           Repeatable reference image URL\n  --video <url>           Repeatable reference video URL\n  --audio <url>           Repeatable reference audio URL\n  --generate-audio        Ask Seedance to generate audio\n  --return-last-frame     Ask Seedance to return the last frame\n\nEnvironment:\n  KIE_API_KEY             Required for live API calls; never printed\n  KIE_CALLBACK_URL        Optional default callback URL\n\nExamples:\n  KIE_API_KEY=... node scripts/kie-assets.mjs credit\n  KIE_API_KEY=... node scripts/kie-assets.mjs create image --prompt \"A unified security operations architecture assembling from fragmented nodes\" --aspect 16:9 --wait\n  KIE_API_KEY=... node scripts/kie-assets.mjs create video --prompt \"A technical environment map assembles from scattered graphite nodes into a coherent system\" --duration 10 --wait\n`;
  console.log(text.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  const repeatable = new Set(['image', 'video', 'audio']);
  const booleans = new Set(['wait', 'dry-run', 'generate-audio', 'return-last-frame']);

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    if (booleans.has(key)) {
      options[key] = true;
      continue;
    }

    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    i += 1;

    if (repeatable.has(key)) {
      options[key] ??= [];
      options[key].push(value);
    } else {
      options[key] = value;
    }
  }

  return { positionals, options };
}

function requireApiKey() {
  const key = process.env.KIE_API_KEY?.trim();
  if (!key) {
    throw new Error('KIE_API_KEY is required for live Kie API calls.');
  }
  return key;
}

async function kieFetch(urlPath, init = {}) {
  const key = requireApiKey();
  const response = await fetch(`${API_BASE}${urlPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!response.ok || (body && typeof body.code === 'number' && body.code >= 400 && body.code !== 505)) {
    const msg = body?.msg || body?.message || response.statusText || 'Kie API request failed';
    throw new Error(`${msg} (HTTP ${response.status}${body?.code ? `, code ${body.code}` : ''})`);
  }

  return body;
}

function buildPrompt(rawPrompt) {
  return `${rawPrompt.trim()}\n\nArt direction requirements: ${DE_STYLE}`;
}

function sanitizeForLog(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function buildCreatePayload(kind, options) {
  const profile = MODEL_PROFILES[kind];
  if (!profile) throw new Error(`Unsupported asset kind: ${kind}`);

  const model = options.model || profile.default;
  if (!profile.allowed.has(model)) {
    throw new Error(`Model '${model}' is not approved for ${kind}. Allowed: ${[...profile.allowed].join(', ')}`);
  }

  if (!options.prompt?.trim()) {
    throw new Error('--prompt is required.');
  }

  const payload = {
    model,
    input: {
      prompt: buildPrompt(options.prompt),
    },
  };

  const callback = options.callback || process.env.KIE_CALLBACK_URL?.trim();
  if (callback) payload.callBackUrl = callback;

  if (kind === 'image') {
    payload.input.aspect_ratio = options.aspect || 'auto';

    if (model === 'nano-banana-2') {
      payload.input.image_input = options.image || [];
      payload.input.resolution = options.resolution || '2K';
      payload.input.output_format = options.format || 'png';
    } else if ((options.image || []).length) {
      throw new Error('Reference images require --model nano-banana-2 in this DE connector.');
    }
  }

  if (kind === 'video') {
    payload.input.reference_image_urls = options.image || [];
    payload.input.reference_video_urls = options.video || [];
    payload.input.reference_audio_urls = options.audio || [];
    payload.input.return_last_frame = Boolean(options['return-last-frame']);
    payload.input.generate_audio = Boolean(options['generate-audio']);
    payload.input.resolution = options.resolution || '720p';
    payload.input.aspect_ratio = options.aspect || '16:9';
    payload.input.duration = Number(options.duration || 10);

    if (!Number.isFinite(payload.input.duration) || payload.input.duration <= 0) {
      throw new Error('--duration must be a positive number.');
    }
  }

  return payload;
}

async function getCredits() {
  const body = await kieFetch('/api/v1/chat/credit', { method: 'GET' });
  console.log(JSON.stringify({ credits: body?.data ?? null }, null, 2));
}

async function getTask(taskId) {
  if (!taskId) throw new Error('taskId is required.');
  return kieFetch(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: 'GET' });
}

function parseResultUrls(taskBody) {
  const resultJson = taskBody?.data?.resultJson;
  if (!resultJson) return [];
  try {
    const parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
    return Array.isArray(parsed?.resultUrls) ? parsed.resultUrls : [];
  } catch {
    return [];
  }
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'asset';
}

async function downloadUrl(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

function inferExtension(url, index) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext && ext.length <= 8) return ext;
  } catch {
    // fall through
  }
  return `.bin${index}`;
}

async function persistResults({ taskBody, payload, outputRoot }) {
  const taskId = taskBody?.data?.taskId || 'unknown-task';
  const resultUrls = parseResultUrls(taskBody);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const promptSlug = slugify(payload.input.prompt.split('\n')[0]);
  const dir = path.resolve(outputRoot, `${stamp}-${promptSlug}`);
  await fs.mkdir(dir, { recursive: true });

  const files = [];
  for (let i = 0; i < resultUrls.length; i += 1) {
    const ext = inferExtension(resultUrls[i], i + 1);
    const fileName = `candidate-${String(i + 1).padStart(2, '0')}${ext}`;
    const filePath = path.join(dir, fileName);
    await downloadUrl(resultUrls[i], filePath);
    files.push(fileName);
  }

  const manifest = {
    provider: 'kie.ai',
    taskId,
    model: payload.model,
    classification: 'ILLUSTRATIVE',
    approvalStatus: 'candidate',
    generatedAt: new Date().toISOString(),
    creditsConsumed: taskBody?.data?.creditsConsumed ?? null,
    prompt: payload.input.prompt,
    input: payload.input,
    resultUrls,
    files,
    note: 'Candidate only. Must pass DE visual review and provenance/claim review before public placement.',
  };
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return { dir, files, manifestPath: path.join(dir, 'manifest.json') };
}

async function waitForTask(taskId, timeoutMs = POLL_TIMEOUT_MS) {
  const started = Date.now();
  let delay = POLL_INTERVAL_MS;

  while (Date.now() - started < timeoutMs) {
    const body = await getTask(taskId);
    const state = body?.data?.state;
    const progress = body?.data?.progress;
    console.log(JSON.stringify({ taskId, state, progress: progress ?? null }));

    if (state === 'success') return body;
    if (state === 'fail') {
      throw new Error(`Kie task failed: ${body?.data?.failMsg || body?.data?.failCode || 'unknown failure'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(Math.round(delay * 1.4), 10000);
  }

  throw new Error(`Timed out waiting for Kie task ${taskId}.`);
}

async function create(kind, options) {
  const payload = buildCreatePayload(kind, options);

  if (options['dry-run']) {
    console.log(JSON.stringify({ endpoint: '/api/v1/jobs/createTask', payload: sanitizeForLog(payload) }, null, 2));
    return;
  }

  const body = await kieFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const taskId = body?.data?.taskId;
  if (!taskId) {
    throw new Error('Kie did not return a taskId.');
  }

  console.log(JSON.stringify({ taskId, model: payload.model }, null, 2));

  if (!options.wait) return;

  const taskBody = await waitForTask(taskId);
  const persisted = await persistResults({
    taskBody,
    payload,
    outputRoot: options.out || DEFAULT_OUTPUT_ROOT,
  });

  console.log(JSON.stringify({
    taskId,
    state: taskBody?.data?.state,
    creditsConsumed: taskBody?.data?.creditsConsumed ?? null,
    outputDirectory: persisted.dir,
    files: persisted.files,
    manifest: persisted.manifestPath,
  }, null, 2));
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const [command, subcommand] = positionals;

  if (!command || command === 'help') usage(0);

  if (command === 'credit') {
    await getCredits();
    return;
  }

  if (command === 'status') {
    const body = await getTask(subcommand);
    const safe = {
      taskId: body?.data?.taskId ?? subcommand,
      model: body?.data?.model ?? null,
      state: body?.data?.state ?? null,
      progress: body?.data?.progress ?? null,
      creditsConsumed: body?.data?.creditsConsumed ?? null,
      failCode: body?.data?.failCode || null,
      failMsg: body?.data?.failMsg || null,
      resultUrls: parseResultUrls(body),
    };
    console.log(JSON.stringify(safe, null, 2));
    return;
  }

  if (command === 'create') {
    if (!subcommand || !MODEL_PROFILES[subcommand]) {
      throw new Error("create requires 'image' or 'video'.");
    }
    await create(subcommand, options);
    return;
  }

  usage(1);
}

main().catch((error) => {
  console.error(`Kie asset CLI error: ${error.message}`);
  process.exitCode = 1;
});
