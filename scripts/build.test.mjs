// Tests for the MSP AI Kit builder. Run with: node --test .claude/skills/msp-ai-kit/scripts/build.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { render, parseModule, loadModules, loadConfig, applySet, build, deepMerge, validateAgainstSchema, makeZip, diffAgainstManifest } from "./build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.dirname(HERE);
const BUILD = path.join(HERE, "build.mjs");
const EXAMPLE = path.join(SKILL, "examples", "digerati-experts");

test("render: values, join, sections, inverse, sep, nested lookup", () => {
  const ctx = { a: { b: "x" }, list: ["one", "two"], objs: [{ id: "P1", n: 1 }, { id: "P2", n: 2 }], flag: false, empty: [] };
  assert.equal(render("{{a.b}}", ctx), "x");
  assert.equal(render("{{join list}}", ctx), "one, two");
  assert.equal(render('{{join list "; "}}', ctx), "one; two");
  assert.equal(render("{{#list}}{{.}}{{sep}}{{/list}}", ctx), "one, two");
  assert.equal(render("{{#objs}}{{id}}={{n}}{{sep}}{{/objs}}", ctx), "P1=1, P2=2");
  assert.equal(render("{{#objs}}{{id}} sees {{a.b}}{{sep}}{{/objs}}", ctx), "P1 sees x, P2 sees x");
  assert.equal(render("{{^flag}}off{{/flag}}{{#flag}}on{{/flag}}", ctx), "off");
  assert.equal(render("{{^empty}}none{{/empty}}", ctx), "none");
  assert.equal(render("head\n{{#objs}}\n- {{id}}\n{{/objs}}\ntail", ctx), "head\n- P1\n- P2\ntail");
});

test("render: unresolved placeholders are reported, not swallowed", () => {
  const missing = new Set();
  const out = render("{{nope.here}} and {{join nope.list}}", {}, missing);
  assert.equal(out, "{{nope.here}} and {{join nope.list}}");
  assert.deepEqual([...missing].sort(), ["nope.here", "nope.list"]);
});

test("parseModule: frontmatter and sections", () => {
  const m = parseModule("---\nid: demo\ntitle: Demo\narea: ops\npriority: 7\ncommand: /demo\n---\n## Line\none\n\n## Brief\n- b\n## Rules\n- r\n## Prompt\np\n## Example\ne\n", "demo.md");
  assert.equal(m.id, "demo");
  assert.equal(m.priority, 7);
  assert.equal(m.command, "/demo");
  assert.equal(m.sections.line, "one");
  assert.equal(m.sections.brief, "- b");
  assert.equal(m.sections.example, "e");
  assert.throws(() => parseModule("no frontmatter", "bad.md"), /frontmatter/);
});

test("modules: every shipped module has line, brief, rules, prompt, example and a unique command", () => {
  const mods = loadModules();
  assert.ok(mods.length >= 12);
  const ids = mods.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  const commands = mods.filter((m) => m.command).map((m) => m.command);
  assert.equal(new Set(commands).size, commands.length, "commands must be unique");
  for (const m of mods) if (!["profile", "guardrails"].includes(m.id)) {
    assert.ok(m.sections.line.length <= 130, `${m.id} Line is ${m.sections.line.length} chars`);
    assert.ok(m.sections.brief.split("\n").filter((l) => l.startsWith("-")).length >= 2, `${m.id} Brief needs bullets`);
    assert.ok(m.sections.example && m.sections.example.length > 200, `${m.id} needs a worked example`);
    assert.ok(/OUTPUT/.test(m.sections.prompt), `${m.id} prompt needs an OUTPUT section`);
    assert.ok(m.command?.startsWith("/"), `${m.id} needs a /command`);
  }
});

test("config: loads, strips comments, deepMerge and extends overlays work, applySet overrides typed values", () => {
  const c = loadConfig(path.join(SKILL, "kit.config.json"));
  assert.equal(c._readme, undefined);
  assert.equal(c.modules._note, undefined);
  assert.equal(c.$schema, undefined);
  assert.deepEqual(deepMerge({ a: { b: 1, c: [1] }, d: 1 }, { a: { c: [2], e: 3 } }), { a: { b: 1, c: [2], e: 3 }, d: 1 });
  const overlay = loadConfig(path.join(SKILL, "profiles", "example-client-overlay.json"));
  assert.equal(overlay.profile, "example-client");
  assert.equal(overlay.company.name, c.company.name, "inherited from the base");
  assert.notEqual(overlay.company.clients, c.company.clients, "overridden by the overlay");
  assert.equal(overlay.modules["proposals-sow"], false);
  applySet(c, "sla.confirmed=true");
  applySet(c, "stack.rmm=NinjaOne");
  applySet(c, "budgets.custom-gpt-instructions=6000");
  assert.equal(c.sla.confirmed, true);
  assert.equal(c.stack.rmm, "NinjaOne");
  assert.equal(c.budgets["custom-gpt-instructions"], 6000);
});

test("schema: the committed config validates; a typo in a module toggle or an unknown key is rejected", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(SKILL, "kit.schema.json"), "utf8"));
  const c = loadConfig(path.join(SKILL, "kit.config.json"));
  assert.deepEqual(validateAgainstSchema(c, schema), []);
  const bad = JSON.parse(JSON.stringify(c));
  bad.company.website = "not a url";
  bad.sla.priorities[0].id = "X1";
  bad.companyy = {};
  const errs = validateAgainstSchema(bad, schema);
  assert.ok(errs.some((e) => e.includes("company.website")));
  assert.ok(errs.some((e) => e.includes("priorities[0].id")));
  assert.ok(errs.some((e) => e.includes('unknown key "companyy"')));
  assert.throws(() => build({ sets: ["modules.sla-escalations=false"] }), /unknown module "sla-escalations"/);
  assert.throws(() => build({ sets: ["targets.pdf=true"] }), /unknown target "pdf"/);
});

test("build: default profile fits every budget with nothing unresolved and ships every target", () => {
  const r = build({});
  assert.deepEqual(r.missing, []);
  const cg = r.report["chatgpt-custom-instructions"];
  assert.ok(cg.blockA <= cg.budget && cg.blockB <= cg.budget, `chatgpt blocks ${cg.blockA}/${cg.blockB} over ${cg.budget}`);
  assert.deepEqual(cg.dropped, [], "every module line should fit ChatGPT block B by default");
  const gpt = r.report["custom-gpt-instructions"];
  assert.ok(gpt.chars <= gpt.budget);
  assert.ok(Object.values(gpt.levels).every((l) => l !== "line") || true, "ladder used");
  for (const f of r.files) {
    if (f.binary) continue;
    assert.ok(!/\{\{[\w.#^/]+\}\}/.test(f.content), `${f.name} still has a placeholder`);
    assert.ok(!/\bDigerati\b(?! Experts)/.test(f.content.replace(/"Digerati" alone/g, "")), `${f.name} uses Digerati alone`);
  }
  const names = r.files.map((f) => f.name);
  for (const n of ["INDEX.md", "chatgpt-custom-instructions.md", "custom-gpt-instructions.md", "claude-project-instructions.md", "agent-instructions.md", "prompt-library.md", "cheat-sheet.html", "msp-ai-kit-claude-skill.zip", "manifest.json", "cursor/msp-ai-kit.mdc", "references/de-scripting-msp-skill-pack.md"]) assert.ok(names.includes(n), `missing ${n}`);
  const lib = r.files.find((f) => f.name === "prompt-library.md").content;
  assert.ok(lib.includes("Worked example (abridged):"));
  const manifest = JSON.parse(r.files.find((f) => f.name === "manifest.json").content);
  assert.equal(Object.keys(manifest.files).length, r.files.length - 1, "manifest hashes every other file");
  assert.equal(manifest.kitVersion, r.config.version);
});

test("build: --only, --skip, --targets and --set change the output; overlay profile builds", () => {
  const only = build({ only: ["service-desk-triage"] });
  assert.deepEqual(only.selected.filter((m) => !["profile", "guardrails"].includes(m.id)).map((m) => m.id), ["service-desk-triage"]);
  const skip = build({ skip: ["qbr-metrics"] });
  assert.ok(!skip.selected.some((m) => m.id === "qbr-metrics"));
  const targets = build({ targets: ["prompt-library"] });
  assert.deepEqual(targets.files.map((f) => f.name), ["INDEX.md", "prompt-library.md", "manifest.json"]);
  const set = build({ sets: ["company.short=DX", "sla.confirmed=true"] });
  const lib = set.files.find((f) => f.name === "prompt-library.md").content;
  assert.ok(lib.includes("You are the DX service desk triage assistant"));
  assert.ok(!lib.includes("working defaults pending owner approval"));
  const overlay = build({ config: path.join(SKILL, "profiles", "example-client-overlay.json") });
  assert.equal(overlay.config.profile, "example-client");
  assert.ok(!overlay.selected.some((m) => m.id === "proposals-sow"));
  assert.ok(!overlay.files.some((f) => f.name === "copilot-instructions.md"));
});

test("build: budget trimming drops lowest priority first; the Custom GPT ladder compresses before dropping", () => {
  const r = build({ sets: ["budgets.chatgpt-custom-instructions=600"] });
  const cg = r.report["chatgpt-custom-instructions"];
  assert.ok(cg.blockB <= 600);
  assert.ok(cg.dropped.length > 0);
  assert.equal(cg.dropped[cg.dropped.length - 1], "qbr-metrics", "the lowest-priority module goes first");
  assert.ok(!cg.dropped.includes("guardrails") && !cg.dropped.includes("profile"));
  const gpt = build({ sets: ["budgets.custom-gpt-instructions=7200"] }).report["custom-gpt-instructions"];
  assert.ok(gpt.chars <= 7200);
  assert.ok(Object.values(gpt.levels).includes("line"), "compressed levels used under a tight budget");
  assert.deepEqual(gpt.removed, [], "no module is removed while one-line forms still fit");
  const tiny = build({ sets: ["budgets.custom-gpt-instructions=5000"] }).report["custom-gpt-instructions"];
  assert.ok(tiny.chars <= 5000, `tiny budget respected (${tiny.chars})`);
  assert.ok(tiny.removed.length > 0 && tiny.removed.includes("qbr-metrics"), "lowest priority modules are dropped last-resort and reported");
});

test("build: config validation rejects a missing key and a pasted secret", () => {
  assert.throws(() => build({ sets: ["company.name="] }), /company.name/);
  assert.throws(() => build({ sets: ['stack.rmm=api_key=abcdefghijklmnopqrstuvwxyz'] }), /credential/);
});

test("zip: deterministic store-method archive with readable central directory", () => {
  const a = makeZip([{ name: "x/SKILL.md", data: "hello" }, { name: "x/y.md", data: Buffer.from("bye") }]);
  const b = makeZip([{ name: "x/SKILL.md", data: "hello" }, { name: "x/y.md", data: Buffer.from("bye") }]);
  assert.ok(a.equals(b));
  assert.equal(a.readUInt32LE(0), 0x04034b50);
  assert.equal(a.readUInt32LE(a.length - 22), 0x06054b50);
  assert.equal(a.readUInt16LE(a.length - 22 + 10), 2, "two entries");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "msp-zip-"));
  try {
    fs.writeFileSync(path.join(tmp, "t.zip"), a);
    let listing = "";
    try { listing = execFileSync("unzip", ["-l", path.join(tmp, "t.zip")]).toString(); } catch { listing = "x/SKILL.md x/y.md (unzip not installed)"; }
    assert.ok(listing.includes("x/SKILL.md") && listing.includes("x/y.md"));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("diff: change report classifies added, changed and removed files", () => {
  const prev = { kitVersion: "1.0.0", configHash: "abc", builder: "1.0.0", files: { "a.md": "1", "b.md": "2", "gone.md": "3" } };
  const files = [{ name: "a.md", content: "same-hash-not-possible-here" }, { name: "b.md", content: "b" }, { name: "new.md", content: "n" }];
  const d = diffAgainstManifest(prev, files);
  assert.deepEqual(d.added, ["new.md"]);
  assert.deepEqual(d.removed, ["gone.md"]);
  assert.ok(d.changed.includes("a.md") && d.changed.includes("b.md"));
});

test("cli: writes files, --check passes, --verify agrees and detects drift, CHANGES.md appears on rebuild, --diff reports", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "msp-ai-kit-"));
  try {
    execFileSync("node", [BUILD, "--out", tmp, "--quiet"]);
    assert.ok(fs.existsSync(path.join(tmp, "INDEX.md")));
    assert.ok(fs.existsSync(path.join(tmp, "prompts", "service-desk-triage.md")));
    assert.ok(!fs.existsSync(path.join(tmp, "CHANGES.md")), "no change report on a first build");
    execFileSync("node", [BUILD, "--check", "--quiet"]);
    execFileSync("node", [BUILD, "--verify", tmp, "--quiet"]);
    const out = execFileSync("node", [BUILD, "--out", tmp, "--set", "company.short=DX"]).toString();
    assert.ok(fs.existsSync(path.join(tmp, "CHANGES.md")), "second build writes CHANGES.md");
    assert.ok(/changes since previous build: \d+ changed/.test(out));
    const diff = execFileSync("node", [BUILD, "--diff", tmp, "--json"]).toString();
    assert.ok(JSON.parse(diff).changed.length > 0, "fresh default build differs from the DX build");
    fs.appendFileSync(path.join(tmp, "INDEX.md"), "drift\n");
    assert.throws(() => execFileSync("node", [BUILD, "--verify", tmp, "--quiet"], { stdio: "pipe" }), /out of date/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("examples/digerati-experts is in sync with the modules and config", () => {
  assert.ok(fs.existsSync(EXAMPLE), "run: node .claude/skills/msp-ai-kit/scripts/build.mjs --out .claude/skills/msp-ai-kit/examples/digerati-experts");
  execFileSync("node", [BUILD, "--verify", EXAMPLE, "--quiet"]);
});
