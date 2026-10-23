/*
 * Pre-renders blog narration to static MP3s under client/public/audio/narration/.
 *
 * Why: the live Listen button depended on a paid OpenAI call at click time.
 * When that call failed (quota, billing, gateway), readers heard the device
 * voice and saw an error banner. Rendering once and serving static files
 * removes the runtime dependency entirely.
 *
 * Cost guard: DRY RUN by default. Prints characters and estimated USD and
 * makes no API call. Pass --confirm to render. Existing files are skipped
 * (so re-running costs nothing) unless --force is given.
 *
 *   npx tsx scripts/render-narration.ts                 # dry run, no spend
 *   OPENAI_API_KEY=... npx tsx scripts/render-narration.ts --confirm
 *   ... --confirm --only=<slug>                         # one post
 *
 * Joe approved this path on 2026-10-22 as option 1 of the voice fix.
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blogBodies } from "../client/src/data/resourceRegistry";
import {
  narrationTextFor,
  narrationPath,
  NARRATION_VOICE,
  type NarrationView,
} from "../client/src/lib/narrationText";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "client", "public", "audio", "narration");

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const force = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1] : null;

const TTS_MODEL = "tts-1";
const MAX_CHARS = 4000; // tts-1 input limit is 4096
const USD_PER_1M_CHARS = 15; // tts-1 list price; re-check at billing time

type Job = { slug: string; view: NarrationView; text: string };

function chunk(text: string): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_CHARS) {
    let cut = rest.lastIndexOf(". ", MAX_CHARS);
    if (cut < MAX_CHARS * 0.5) cut = MAX_CHARS;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

const jobs: Job[] = [];
for (const [slug, body] of Object.entries(blogBodies)) {
  if (only && slug !== only) continue;
  const dual = !!(body.overviewBlocks && body.extendedBlocks);
  if (dual) {
    jobs.push({ slug, view: "overview", text: narrationTextFor(body.overviewBlocks!) });
    jobs.push({ slug, view: "extended", text: narrationTextFor(body.extendedBlocks!) });
  } else {
    // Single-version posts are played under the "overview" key by the player.
    jobs.push({ slug, view: "overview", text: narrationTextFor(body.blocks ?? []) });
  }
}

const totalChars = jobs.reduce((n, j) => n + j.text.length, 0);
const estUsd = (totalChars / 1_000_000) * USD_PER_1M_CHARS;
console.log(`Posts/views: ${jobs.length}`);
console.log(`Characters:  ${totalChars.toLocaleString()}`);
console.log(`Estimated:   $${estUsd.toFixed(2)} (${TTS_MODEL}, voice ${NARRATION_VOICE})`);

if (!confirm) {
  console.log("\nDRY RUN. Nothing was sent. Add --confirm to render.");
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
if (!apiKey) {
  console.error("OPENAI_API_KEY is not set. Nothing rendered.");
  process.exit(1);
}

async function speak(input: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: NARRATION_VOICE,
      input,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

mkdirSync(outDir, { recursive: true });
const manifest: Record<string, { file: string; chars: number; renderedAt: string }> = {};

for (const job of jobs) {
  const path = narrationPath(job.slug, job.view);
  const file = join(root, "client", "public", path);
  const key = `${job.slug}.${job.view}`;

  if (existsSync(file) && !force) {
    console.log(`skip   ${key} (exists)`);
    continue;
  }
  const parts = chunk(job.text);
  const buffers: Buffer[] = [];
  for (const p of parts) buffers.push(await speak(p));
  writeFileSync(file, Buffer.concat(buffers));
  manifest[key] = { file: path, chars: job.text.length, renderedAt: new Date().toISOString() };
  console.log(`render ${key} (${parts.length} part(s))`);
}

// Keep one manifest of what was rendered and when, for audits and re-runs.
const manifestPath = join(outDir, "manifest.json");
let prior: Record<string, unknown> = {};
if (existsSync(manifestPath)) {
  try {
    prior = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    prior = {};
  }
}
writeFileSync(manifestPath, JSON.stringify({ ...prior, ...manifest }, null, 2) + "\n");
console.log(`\nDone. Manifest: ${manifestPath}`);
