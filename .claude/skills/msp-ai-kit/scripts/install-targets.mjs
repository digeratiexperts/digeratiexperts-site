#!/usr/bin/env node
// Installs a built pack into the places agents actually read, instead of asking a
// person to paste: repository rule files and the user-level CLAUDE.md. Idempotent;
// managed blocks are delimited by markers so reruns replace only their own text.
//
//   node .claude/skills/msp-ai-kit/scripts/install-targets.mjs --repo . --all
//   node .claude/skills/msp-ai-kit/scripts/install-targets.mjs --repo ../ops-scripts --cursor --copilot
//   node .claude/skills/msp-ai-kit/scripts/install-targets.mjs --user            # ~/.claude/CLAUDE.md block
//   node .claude/skills/msp-ai-kit/scripts/install-targets.mjs --repo . --all --remove
//   node .claude/skills/msp-ai-kit/scripts/install-targets.mjs --repo . --all --dry-run
//
// Options
//   --pack <dir>     built pack to install from (default: <output_dir>/<profile> from the config, else examples/digerati-experts)
//   --repo <dir>     a repository to install into (repeatable)
//   --cursor         write <repo>/.cursor/rules/msp-ai-kit.mdc (whole file, owned by this tool)
//   --copilot        managed block in <repo>/.github/copilot-instructions.md
//   --claude-md      managed block in <repo>/CLAUDE.md
//   --agents-md      managed block in <repo>/AGENTS.md
//   --all            cursor + copilot + claude-md + agents-md
//   --user           managed block in ~/.claude/CLAUDE.md (user-level Claude Code instructions)
//   --remove         remove the managed blocks and the cursor rule instead of installing
//   --dry-run        report without writing
//   --json           machine-readable report
//
// The managed block is short by design: house rules, guardrails and the command
// table, plus a pointer to the full prompt library path. It never contains
// secrets and never touches text outside its markers.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(HERE);
const START = "<!-- msp-ai-kit:start (managed by .claude/skills/msp-ai-kit/scripts/install-targets.mjs; edit the kit, not this block) -->";
const END = "<!-- msp-ai-kit:end -->";

function parseArgs(argv) {
  const a = { repos: [], cursor: false, copilot: false, claudeMd: false, agentsMd: false, user: false, remove: false, dryRun: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    switch (v) {
      case "--pack": a.pack = argv[++i]; break;
      case "--repo": a.repos.push(argv[++i]); break;
      case "--cursor": a.cursor = true; break;
      case "--copilot": a.copilot = true; break;
      case "--claude-md": a.claudeMd = true; break;
      case "--agents-md": a.agentsMd = true; break;
      case "--all": a.cursor = a.copilot = a.claudeMd = a.agentsMd = true; break;
      case "--user": a.user = true; break;
      case "--remove": a.remove = true; break;
      case "--dry-run": a.dryRun = true; break;
      case "--json": a.json = true; break;
      case "-h": case "--help": a.help = true; break;
      default: console.error(`unknown option ${v}`); process.exit(2);
    }
  }
  return a;
}

function defaultPack() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "kit.config.json"), "utf8"));
    const p = path.resolve(SKILL_DIR, "..", "..", "..", cfg.output_dir || "artifacts/msp-ai-kit/out", cfg.profile);
    if (fs.existsSync(path.join(p, "INDEX.md"))) return p;
  } catch { /* fall through */ }
  return path.join(SKILL_DIR, "examples", "digerati-experts");
}

export function managedBlock(agentInstructions, packDir) {
  // keep house rules, command table and guardrails; drop the per-module rule sections to stay short
  const lines = agentInstructions.split("\n");
  const out = [];
  let skipping = false;
  for (const l of lines) {
    if (/^### /.test(l)) { skipping = true; continue; }
    if (/^## Guardrails/.test(l)) skipping = false;
    if (!skipping) out.push(l);
  }
  const body = out.join("\n").replace(/^# .*\n/, "").trim();
  return `${START}\n## Digerati Experts MSP AI Kit\n\nFull playbooks: \`${packDir}\` (prompt-library.md, prompts/, references/). Regenerate with \`node .claude/skills/msp-ai-kit/scripts/build.mjs\`.\n\n${body}\n${END}`;
}

export function upsertBlock(existing, block) {
  const re = new RegExp(`${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`);
  if (re.test(existing)) {
    const next = existing.replace(re, block);
    return { text: next, changed: next !== existing, action: next === existing ? "NO CHANGE" : "updated block" };
  }
  const sep = existing.length && !existing.endsWith("\n") ? "\n" : "";
  return { text: `${existing}${sep}${existing.length ? "\n" : ""}${block}\n`, changed: true, action: "added block" };
}

export function removeBlock(existing) {
  const re = new RegExp(`\\n?${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}\\n?`);
  const next = existing.replace(re, "\n").replace(/\n{3,}$/, "\n");
  return { text: next, changed: next !== existing, action: next === existing ? "NO CHANGE" : "removed block" };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function applyBlock(file, block, args, results, label) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!fs.existsSync(file) && args.remove) { results.push({ target: label, file, action: "NO CHANGE", detail: "file absent" }); return; }
  const r = args.remove ? removeBlock(existing) : upsertBlock(existing, block);
  if (r.changed && !args.dryRun) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, r.text); }
  results.push({ target: label, file, action: args.dryRun && r.changed ? `would: ${r.action}` : r.action });
}

function applyCursor(file, ruleText, args, results) {
  if (args.remove) {
    if (!fs.existsSync(file)) { results.push({ target: "cursor", file, action: "NO CHANGE" }); return; }
    if (!args.dryRun) fs.unlinkSync(file);
    results.push({ target: "cursor", file, action: args.dryRun ? "would: removed" : "removed" });
    return;
  }
  const same = fs.existsSync(file) && fs.readFileSync(file, "utf8") === ruleText;
  if (!same && !args.dryRun) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, ruleText); }
  results.push({ target: "cursor", file, action: same ? "NO CHANGE" : (args.dryRun ? "would: written" : "written") });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1).filter((l) => l.startsWith("//")).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return; }
  const pack = path.resolve(args.pack || defaultPack());
  const agentFile = path.join(pack, "agent-instructions.md");
  const ruleFile = path.join(pack, "cursor", "msp-ai-kit.mdc");
  if (!fs.existsSync(agentFile)) { console.error(`install-targets: no agent-instructions.md in ${pack}; build first`); process.exit(2); }
  if (!args.repos.length && !args.user) { console.error("install-targets: pass --repo <dir> and/or --user"); process.exit(2); }
  const block = managedBlock(fs.readFileSync(agentFile, "utf8"), pack);
  const results = [];
  for (const repoArg of args.repos) {
    const repo = path.resolve(repoArg);
    if (!fs.existsSync(repo)) { results.push({ target: "repo", file: repo, action: "SKIPPED", detail: "not found" }); continue; }
    if (args.cursor) {
      if (!fs.existsSync(ruleFile)) results.push({ target: "cursor", file: ruleFile, action: "SKIPPED", detail: "cursor-rule target not built" });
      else applyCursor(path.join(repo, ".cursor", "rules", "msp-ai-kit.mdc"), fs.readFileSync(ruleFile, "utf8"), args, results);
    }
    if (args.copilot) applyBlock(path.join(repo, ".github", "copilot-instructions.md"), block, args, results, "copilot");
    if (args.claudeMd) applyBlock(path.join(repo, "CLAUDE.md"), block, args, results, "claude-md");
    if (args.agentsMd) applyBlock(path.join(repo, "AGENTS.md"), block, args, results, "agents-md");
  }
  if (args.user) applyBlock(path.join(os.homedir(), ".claude", "CLAUDE.md"), block, args, results, "user-claude-md");
  if (args.json) console.log(JSON.stringify({ pack, dryRun: args.dryRun, remove: args.remove, results }, null, 2));
  else { console.log(`pack: ${pack}${args.dryRun ? " (dry run)" : ""}`); for (const r of results) console.log(`  ${r.action.padEnd(22)} ${r.target.padEnd(14)} ${r.file}${r.detail ? `  (${r.detail})` : ""}`); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
