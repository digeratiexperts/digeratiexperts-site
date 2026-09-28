// Tests for the MSP AI Kit builder. Run with: node --test .claude/skills/msp-ai-kit/scripts/build.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { render, parseModule, loadModules, loadConfig, applySet, build } from "./build.mjs";

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
  const m = parseModule("---\nid: demo\ntitle: Demo\narea: ops\npriority: 7\ncommand: /demo\n---\n## Line\none\n\n## Rules\n- r\n## Prompt\np\n", "demo.md");
  assert.equal(m.id, "demo");
  assert.equal(m.priority, 7);
  assert.equal(m.command, "/demo");
  assert.equal(m.sections.line, "one");
  assert.equal(m.sections.rules, "- r");
  assert.equal(m.sections.prompt, "p");
  assert.throws(() => parseModule("no frontmatter", "bad.md"), /frontmatter/);
});

test("modules: every shipped module has the required sections and a unique id", () => {
  const mods = loadModules();
  assert.ok(mods.length >= 10);
  const ids = mods.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of mods) if (!["profile", "guardrails"].includes(m.id)) {
    assert.ok(m.sections.line.length <= 130, `${m.id} Line is ${m.sections.line.length} chars; keep it short so ChatGPT block B fits`);
    assert.ok(m.command?.startsWith("/"), `${m.id} needs a /command`);
  }
});

test("config: loads, strips underscore comments, applySet overrides nested and typed values", () => {
  const c = loadConfig(path.join(SKILL, "kit.config.json"));
  assert.equal(c._readme, undefined);
  assert.equal(c.modules._note, undefined);
  applySet(c, "sla.confirmed=true");
  applySet(c, "stack.rmm=NinjaOne");
  applySet(c, "budgets.custom-gpt-instructions=6000");
  applySet(c, "new.deep.key=[1,2]");
  assert.equal(c.sla.confirmed, true);
  assert.equal(c.stack.rmm, "NinjaOne");
  assert.equal(c.budgets["custom-gpt-instructions"], 6000);
  assert.deepEqual(c.new.deep.key, [1, 2]);
});

test("build: default profile fits every budget with nothing unresolved", () => {
  const r = build({});
  assert.deepEqual(r.missing, []);
  const cg = r.report["chatgpt-custom-instructions"];
  assert.ok(cg.blockA <= cg.budget && cg.blockB <= cg.budget, `chatgpt blocks ${cg.blockA}/${cg.blockB} over ${cg.budget}`);
  assert.deepEqual(cg.dropped, [], "every module line should fit ChatGPT block B by default");
  const gpt = r.report["custom-gpt-instructions"];
  assert.ok(gpt.chars <= gpt.budget);
  for (const f of r.files) {
    assert.ok(!/\{\{[\w.#^/]+\}\}/.test(f.content), `${f.name} still has a placeholder`);
    assert.ok(!/\bDigerati\b(?! Experts)/.test(f.content.replace(/"Digerati" alone/g, "")), `${f.name} uses Digerati alone`);
  }
  const names = r.files.map((f) => f.name);
  assert.ok(names.includes(path.join("references", "de-scripting-msp-skill-pack.md")), "the DE scripting pack ships with the outputs");
  for (const n of ["INDEX.md", "chatgpt-custom-instructions.md", "custom-gpt-instructions.md", "claude-project-instructions.md", "agent-instructions.md", "prompt-library.md", "manifest.json", path.join("cursor", "msp-ai-kit.mdc")]) assert.ok(names.includes(n), `missing ${n}`);
});

test("build: --only, --skip, --targets and --set change the output", () => {
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
});

test("build: budget trimming drops lowest priority first and reports it", () => {
  const r = build({ sets: ["budgets.chatgpt-custom-instructions=600"] });
  const cg = r.report["chatgpt-custom-instructions"];
  assert.ok(cg.blockB <= 600);
  assert.ok(cg.dropped.length > 0);
  assert.equal(cg.dropped[cg.dropped.length - 1], "qbr-metrics", "the lowest-priority module goes first");
  assert.ok(!cg.dropped.includes("guardrails") && !cg.dropped.includes("profile"));
});

test("build: config validation rejects a missing key and a pasted secret", () => {
  assert.throws(() => build({ sets: ["company.name="] }), /missing company.name/);
  assert.throws(() => build({ sets: ['stack.rmm=api_key=abcdefghijklmnopqrstuvwxyz'] }), /credential/);
});

test("cli: writes files, --check passes, --verify agrees with a fresh build and detects drift", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "msp-ai-kit-"));
  try {
    execFileSync("node", [BUILD, "--out", tmp, "--quiet"]);
    assert.ok(fs.existsSync(path.join(tmp, "INDEX.md")));
    assert.ok(fs.existsSync(path.join(tmp, "prompts", "service-desk-triage.md")));
    execFileSync("node", [BUILD, "--check", "--quiet"]);
    execFileSync("node", [BUILD, "--verify", tmp, "--quiet"]);
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
