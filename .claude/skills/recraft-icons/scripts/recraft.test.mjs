// node --test .claude/skills/recraft-icons/scripts/recraft.test.mjs  (offline; no key, no credits)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildGenerationPayload, buildPrompt, cleanSvg, coversCanvas, isNearWhite, loadApiKey, loadSpec, main, slugify,
} from "./recraft.mjs";

const spec = loadSpec();

test("DE spec targets a vector model with the graphite-on-white controls", () => {
  assert.match(spec.model, /vector/);
  assert.deepEqual(spec.controls.colors, [{ rgb: [5, 3, 18] }]);
  assert.equal(spec.controls.no_text, true);
});

test("prompt fills the subject and rejects an empty one", () => {
  assert.match(buildPrompt(spec, "a padlock over a cloud"), /^Minimal line icon of a padlock over a cloud\./);
  assert.throws(() => buildPrompt(spec, "  "), /--subject is required/);
});

test("payload: defaults, n bounds, style_id switches to the styles model", () => {
  const p = buildGenerationPayload(spec, { subject: "server rack" });
  assert.equal(p.model, "recraftv4_1_utility_vector");
  assert.equal(p.n, 2);
  assert.equal(p.size, "1024x1024");
  assert.equal(p.response_format, "url");
  assert.ok(p.negative_prompt.includes("text"));
  assert.throws(() => buildGenerationPayload(spec, { subject: "x", n: 9 }), /--n must be/);

  const id = "123e4567-e89b-12d3-a456-426614174000";
  const s = buildGenerationPayload(spec, { subject: "x", styleId: id });
  assert.equal(s.model, "recraftv4_styles_vector");
  assert.equal(s.style_id, id);
  assert.equal(s.style_match, "precise");
  assert.throws(() => buildGenerationPayload(spec, { subject: "x", styleId: "nope" }), /UUID/);
  assert.throws(() => buildGenerationPayload(spec, { subject: "x", model: "recraftv4_1" }), /not a vector model/);
});

test("near-white detection", () => {
  for (const c of ["#fff", "#FFFFFF", "white", "rgb(250, 250, 250)", "#f7f5f2"]) assert.equal(isNearWhite(c), true, c);
  for (const c of ["#050312", "#D3126A", "none", "currentColor"]) assert.equal(isNearWhite(c), false, c);
});

test("canvas-covering background detection for rect and absolute path", () => {
  const box = { x: 0, y: 0, w: 1024, h: 1024 };
  assert.equal(coversCanvas('<rect width="1024" height="1024" fill="#fff"/>', box), true);
  assert.equal(coversCanvas('<rect width="100%" height="100%"/>', box), true);
  assert.equal(coversCanvas('<path d="M0 0 L1024 0 L1024 1024 L0 1024 Z"/>', box), true);
  assert.equal(coversCanvas('<path d="M0 0 H1024 V1024 H0 Z"/>', box), false, "H/V commands are not parsed; kept to be safe");
  assert.equal(coversCanvas('<rect x="200" y="200" width="300" height="300"/>', box), false);
  assert.equal(coversCanvas('<path d="M300 300 L700 300 L700 700 Z"/>', box), false);
});

const RAW = `<?xml version="1.0"?><!-- recraft -->
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" onload="alert(1)">
  <metadata>x</metadata><script>alert(1)</script>
  <rect width="1024" height="1024" fill="#FFFFFF"/>
  <path d="M300 300 L700 300 L700 700 Z" fill="#050312" onclick="steal()"/>
  <path d="M400 400 L500 400 L500 500 Z" fill="rgb(255,255,255)"/>
  <path d="M10 10 L20 20" style="stroke:#060414;fill:none"/>
  <image href="https://evil.example/x.png"/><use xlink:href="#ok"/>
  <rect x="1" y="1" width="2" height="2" fill="url(https://evil.example/p)"/>
</svg>`;

test("cleaner strips active content and external references", () => {
  const { svg } = cleanSvg(RAW);
  for (const bad of ["<script", "onload", "onclick", "<metadata", "<?xml", "<!--", "evil.example"]) {
    assert.ok(!svg.includes(bad), `still contains ${bad}`);
  }
  assert.ok(svg.includes('xlink:href="#ok"'), "internal references are kept");
  assert.ok(!/<svg[^>]*\swidth=/.test(svg) && svg.includes('viewBox="0 0 1024 1024"'), "sized by CSS via viewBox");
});

test("cleaner mono mode: background dropped, glyph rebuilt as a currentColor mask with real knockouts", () => {
  const { svg, report } = cleanSvg(RAW);
  assert.equal(report.removedBackground, true);
  assert.ok(!svg.includes('width="1024" height="1024" fill="#'), "full-canvas plate removed");
  assert.match(svg, /<mask id="de-icon-[a-z0-9]+" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><g fill="#fff">/);
  assert.match(svg, /<rect x="0" y="0" width="1024" height="1024" fill="currentColor" mask="url\(#de-icon-[a-z0-9]+\)"\/><\/svg>/);
  assert.ok(svg.includes('d="M300 300 L700 300 L700 700 Z" fill="#fbfbfb"') || /M300 300[^>]*fill="#f[a-f0-9]{5}"/.test(svg), "dark shape is drawn (near-white in the mask)");
  assert.ok(svg.includes('d="M400 400 L500 400 L500 500 Z" fill="#000000"'), "white detail is cut out");
  assert.ok(/stroke:#f[a-f0-9]{5}/.test(svg), "inline style colours are mapped too");
  assert.equal(report.knockouts, 1);
  assert.equal((svg.match(/currentColor/g) || []).length, 1, "only the shown rect carries the colour");
});

test("cleaner keeps colour when asked and rejects non-SVG input", () => {
  const { svg } = cleanSvg(RAW, { mono: false });
  assert.ok(svg.includes("#050312"));
  assert.throws(() => cleanSvg("<html></html>"), /not an SVG/);
});

test("slugify", () => {
  assert.equal(slugify("Cloud Backup / DR!"), "cloud-backup-dr");
  assert.equal(slugify("***"), "icon");
});

test("key lookup: env first, then a .env walked up from the start dir", () => {
  const root = mkdtempSync(path.join(tmpdir(), "recraft-key-"));
  const deep = path.join(root, "a", "b");
  mkdirSync(deep, { recursive: true });
  writeFileSync(path.join(root, ".env"), "# c\nexport RECRAFT_API_KEY='from-file'\n");
  assert.equal(loadApiKey({ env: {}, starts: [deep] }), "from-file");
  assert.equal(loadApiKey({ env: { RECRAFT_API_KEY: "from-env" }, starts: [deep] }), "from-env");
  assert.equal(loadApiKey({ env: {}, starts: [tmpdir()] }) ?? null, loadApiKey({ env: {}, starts: [tmpdir()] }));
});

test("generate end to end against a stubbed Recraft API writes cleaned SVGs, manifests and a review sheet", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "recraft-e2e-"));
  writeFileSync(path.join(root, "package.json"), "{}");
  const prevCwd = process.cwd();
  const prevFetch = globalThis.fetch;
  const prevKey = process.env.RECRAFT_API_KEY;
  const calls = [];
  process.env.RECRAFT_API_KEY = "test-key";
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/images/generations")) {
      return new Response(JSON.stringify({ created: 1, credits: 2, data: [{ image_id: "a", url: "https://img.test/1.svg" }, { image_id: "b", url: "https://img.test/2.svg" }] }), { status: 200 });
    }
    return new Response(RAW, { status: 200 });
  };
  const log = console.log;
  console.log = () => {};
  try {
    process.chdir(root);
    await main(["generate", "--subject", "a shield with a check", "--name", "Shield Check", "--set", "security"]);
  } finally {
    console.log = log;
    process.chdir(prevCwd);
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.RECRAFT_API_KEY;
    else process.env.RECRAFT_API_KEY = prevKey;
  }

  const gen = calls[0];
  assert.equal(gen.init.method, "POST");
  assert.equal(gen.init.headers.Authorization, "Bearer test-key");
  const sent = JSON.parse(gen.init.body);
  assert.equal(sent.model, "recraftv4_1_utility_vector");
  assert.match(sent.prompt, /a shield with a check/);

  const dir = path.join(root, "artifacts", "recraft", "icons", "security");
  const files = readdirSync(dir).sort();
  const stem = files.find((f) => f.endsWith("-shield-check-1.svg"));
  assert.ok(stem, `cleaned svg missing in ${files.join(", ")}`);
  assert.ok(files.includes(stem.replace(".svg", ".raw.svg")));
  assert.ok(files.includes("review.html"));
  const cleaned = readFileSync(path.join(dir, stem), "utf8");
  assert.ok(!cleaned.includes("<script") && cleaned.includes('fill="currentColor" mask="url(#'));
  const manifest = JSON.parse(readFileSync(path.join(dir, `${stem}.manifest.json`), "utf8"));
  assert.equal(manifest.classification, "ILLUSTRATIVE");
  assert.equal(manifest.approval, "candidate");
  assert.equal(manifest.credits_charged, 2);
  const sheet = readFileSync(path.join(dir, "review.html"), "utf8");
  assert.equal((sheet.match(/<figure>/g) || []).length, 2);
});

test("a 400 on the first request retries once without the optional fields", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "recraft-fallback-"));
  writeFileSync(path.join(root, "package.json"), "{}");
  const prev = { cwd: process.cwd(), fetch: globalThis.fetch, key: process.env.RECRAFT_API_KEY, log: console.log, err: console.error };
  const bodies = [];
  process.env.RECRAFT_API_KEY = "test-key";
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).endsWith("/images/generations")) {
      bodies.push(JSON.parse(init.body));
      if (bodies.length === 1) return new Response(JSON.stringify({ message: "unknown field negative_prompt" }), { status: 400 });
      return new Response(JSON.stringify({ created: 1, credits: 1, data: [{ image_id: "a", url: "https://img.test/1.svg" }] }), { status: 200 });
    }
    return new Response(RAW, { status: 200 });
  };
  console.log = () => {};
  console.error = () => {};
  try {
    process.chdir(root);
    await main(["generate", "--subject", "a router", "--name", "router", "--n", "1"]);
  } finally {
    Object.assign(console, { log: prev.log, error: prev.err });
    process.chdir(prev.cwd);
    globalThis.fetch = prev.fetch;
    if (prev.key === undefined) delete process.env.RECRAFT_API_KEY;
    else process.env.RECRAFT_API_KEY = prev.key;
  }
  assert.equal(bodies.length, 2);
  assert.ok("negative_prompt" in bodies[0]);
  assert.ok(!("negative_prompt" in bodies[1]));
  assert.equal(bodies[1].controls.no_text, undefined);
  assert.deepEqual(bodies[1].controls.colors, [{ rgb: [5, 3, 18] }]);
  const dir = path.join(root, "artifacts", "recraft", "icons", "misc");
  const manifest = readdirSync(dir).find((f) => f.endsWith(".manifest.json"));
  assert.match(JSON.parse(readFileSync(path.join(dir, manifest), "utf8")).request_fallback.reason, /HTTP 400/);
});

test("a repeat run with the same name on the same day does not overwrite earlier candidates", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "recraft-rerun-"));
  writeFileSync(path.join(root, "package.json"), "{}");
  const prev = { cwd: process.cwd(), fetch: globalThis.fetch, key: process.env.RECRAFT_API_KEY, log: console.log };
  process.env.RECRAFT_API_KEY = "test-key";
  globalThis.fetch = async (url) =>
    String(url).endsWith("/images/generations")
      ? new Response(JSON.stringify({ created: 1, credits: 1, data: [{ image_id: "a", url: "https://img.test/1.svg" }] }), { status: 200 })
      : new Response(RAW, { status: 200 });
  console.log = () => {};
  try {
    process.chdir(root);
    await main(["generate", "--subject", "a router", "--name", "router", "--n", "1"]);
    await main(["generate", "--subject", "a router", "--name", "router", "--n", "1"]);
  } finally {
    console.log = prev.log;
    process.chdir(prev.cwd);
    globalThis.fetch = prev.fetch;
    if (prev.key === undefined) delete process.env.RECRAFT_API_KEY;
    else process.env.RECRAFT_API_KEY = prev.key;
  }
  const svgs = readdirSync(path.join(root, "artifacts", "recraft", "icons", "misc")).filter((f) => f.endsWith(".svg") && !f.endsWith(".raw.svg"));
  assert.equal(svgs.length, 2);
  assert.ok(svgs.some((f) => f.endsWith("-router-r2.svg")), svgs.join(", "));
});
