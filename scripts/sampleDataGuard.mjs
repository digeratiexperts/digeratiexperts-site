#!/usr/bin/env node
/**
 * Sample / mock / demo data guardrail (lane A Step 4; plan Phase 4 "Guardrail").
 *
 * DE never ships sample, mock, placeholder or demo data. This scan flags, in
 * PRODUCTION code only (client/src, server, shared — never tests, fixtures or
 * QA scripts):
 *
 *   1. SAMPLE badges and sample-mode copy (sample-badge)
 *   2. imports of mock / sample / demo data modules (sample-data-import)
 *   3. feature flags or switches that enable sample data (sample-data-flag)
 *
 * REPORT-ONLY by default: prints the findings and exits 0. Lane F switches the
 * default to enforce (or pass --enforce) once every Phase 4 feature is built.
 *
 * Usage: node scripts/sampleDataGuard.mjs [--enforce] [--json]
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const SCAN_ROOTS = ["client/src", "server", "shared"];

/** Never scanned: tests, fixtures and QA tooling are allowed to name samples. */
export function isExcludedFile(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  return (
    /(^|\/)(tests?|__tests__|fixtures?|node_modules|dist)\//.test(normalized) ||
    /\.(test|spec|testkit)\.[cm]?[jt]sx?$/.test(normalized) ||
    /FakeDb\.testkit/.test(normalized) ||
    normalized.endsWith("sampleDataGuard.mjs")
  );
}

export const RULES = [
  {
    id: "sample-badge",
    description: "SAMPLE badge or sample-mode copy in production UI",
    pattern: /sample:\s*true|label=\{?["']sample["']|hint=["']sample["']|Sample preview|Sample data|Sample view|Sample figure|Sample allocation/i,
  },
  {
    id: "sample-data-import",
    description: "import of a mock / sample / demo data module",
    pattern: /from\s+["'][^"']*[\/\-_](mock|mocks|sample|samples|demo|demos|fixture|fixtures)[^"']*["']/,
  },
  {
    id: "sample-data-flag",
    description: "feature flag or switch that enables sample data",
    pattern: /\b(ENABLE|ALLOW|FORCE|USE)[A-Z_]*SAMPLE[A-Z_]*\b|\bSAMPLE[A-Z_]*(MODE|DATA|DEMO)[A-Z_]*\s*[:=]|[\?&]sample=1/,
  },
];

/** Scan one source string. Returns { rule, line, text } findings. */
export function scanSource(source) {
  const findings = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i];
    if (/sampleDataGuard|guardrail-off|guardrail: allow/i.test(text)) continue; // self / explicit opt-out
    for (const rule of RULES) {
      if (rule.pattern.test(text)) {
        findings.push({ rule: rule.id, line: i + 1, text: text.trim().slice(0, 160) });
      }
    }
  }
  return findings;
}

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/(^|[\\/])(node_modules|dist|tests?|__tests__|fixtures?)$/.test(full)) continue;
      await walk(full, out);
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !isExcludedFile(full)) {
      out.push(full);
    }
  }
  return out;
}

export async function scanTree(root = process.cwd()) {
  const findings = [];
  for (const scanRoot of SCAN_ROOTS) {
    const files = await walk(path.join(root, scanRoot));
    for (const file of files.sort()) {
      const source = await readFile(file, "utf8");
      for (const finding of scanSource(source)) {
        findings.push({ file: path.relative(root, file).replace(/\\/g, "/"), ...finding });
      }
    }
  }
  return findings;
}

async function main() {
  const enforce = process.argv.includes("--enforce");
  const asJson = process.argv.includes("--json");
  const findings = await scanTree();

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ mode: enforce ? "enforce" : "report", findings }, null, 2)}\n`);
  } else {
    const byRule = new Map();
    for (const finding of findings) {
      const list = byRule.get(finding.rule) ?? [];
      list.push(finding);
      byRule.set(finding.rule, list);
    }
    process.stdout.write(
      `Sample-data guardrail (${enforce ? "ENFORCE" : "report-only"}) — ${findings.length} finding(s)\n`,
    );
    for (const rule of RULES) {
      const list = byRule.get(rule.id) ?? [];
      process.stdout.write(`\n${rule.id} — ${rule.description}: ${list.length}\n`);
      for (const finding of list) {
        process.stdout.write(`  ${finding.file}:${finding.line}: ${finding.text}\n`);
      }
    }
    if (findings.length > 0 && !enforce) {
      process.stdout.write(
        "\nReport-only: exiting 0. Lane F switches this guardrail to enforce (docs/plans/opencode/lane-f-final-qa.md).\n",
      );
    }
    if (findings.length === 0) {
      process.stdout.write("\nNo sample, mock or demo data markers in production code.\n");
    }
  }

  if (enforce && findings.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
