#!/usr/bin/env node
// Keeps the company facts in kit.config.json in step with the website's canonical
// contact module (shared/companyContact.ts) so the packs never drift from what the
// site publishes. No dependencies.
//
//   node .claude/skills/msp-ai-kit/scripts/sync-facts.mjs --check     # exit 1 and list every drifted value
//   node .claude/skills/msp-ai-kit/scripts/sync-facts.mjs --write     # update kit.config.json in place
//   node .claude/skills/msp-ai-kit/scripts/sync-facts.mjs             # print the comparison
//
// Options
//   --repo <dir>     website repository root (default: four levels above this script)
//   --config <file>  control file (default: ../kit.config.json)
//   --json           machine-readable output
//
// Mapping (source -> config key)
//   COMPANY.website            -> company.website
//   COMPANY.supportEmail       -> company.support_email
//   COMPANY.bookingUrl         -> company.booking_url
//   COMPANY.areaServed         -> company.area_served
//   COMPANY.addressLocality + addressRegion -> company.location ("Chandler, Arizona")
// The portal URL, package names and voice are DE decisions kept in the config on purpose.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(HERE);
const REGIONS = { AZ: "Arizona", CA: "California", NV: "Nevada", TX: "Texas", NM: "New Mexico", UT: "Utah", CO: "Colorado" };

function parseArgs(argv) {
  const a = { check: false, write: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--check") a.check = true;
    else if (v === "--write") a.write = true;
    else if (v === "--json") a.json = true;
    else if (v === "--repo") a.repo = argv[++i];
    else if (v === "--config") a.config = argv[++i];
    else if (v === "-h" || v === "--help") a.help = true;
    else { console.error(`unknown option ${v}`); process.exit(2); }
  }
  return a;
}

export function readCompanyConstants(tsSource) {
  const block = tsSource.match(/export const COMPANY = \{([\s\S]*?)\} as const;/);
  if (!block) throw new Error("COMPANY object not found in shared/companyContact.ts");
  const out = {};
  for (const m of block[1].matchAll(/^\s*(\w+):\s*"([^"]*)"\s*,?\s*$/gm)) out[m[1]] = m[2];
  return out;
}

export function expectedFacts(constants) {
  const region = REGIONS[constants.addressRegion] || constants.addressRegion;
  return {
    "company.website": constants.website,
    "company.support_email": constants.supportEmail,
    "company.booking_url": constants.bookingUrl,
    "company.area_served": constants.areaServed,
    "company.location": constants.addressLocality && region ? `${constants.addressLocality}, ${region}` : undefined,
  };
}

function getPath(obj, p) { return p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, p, v) { const ks = p.split("."); let cur = obj; for (const k of ks.slice(0, -1)) { if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {}; cur = cur[k]; } cur[ks[ks.length - 1]] = v; }

export function compareFacts(config, expected) {
  return Object.entries(expected).filter(([, v]) => v !== undefined).map(([key, want]) => ({ key, want, have: getPath(config, key), same: getPath(config, key) === want }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1).filter((l) => l.startsWith("//")).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return; }
  const repo = path.resolve(args.repo || path.join(SKILL_DIR, "..", "..", ".."));
  const configFile = path.resolve(args.config || path.join(SKILL_DIR, "kit.config.json"));
  const tsFile = path.join(repo, "shared", "companyContact.ts");
  if (!fs.existsSync(tsFile)) {
    console.error(`sync-facts: ${tsFile} not found; pass --repo <website repo root>. Skipping (not a drift).`);
    process.exit(args.check ? 0 : 0);
  }
  const constants = readCompanyConstants(fs.readFileSync(tsFile, "utf8"));
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  const rows = compareFacts(config, expectedFacts(constants));
  const drift = rows.filter((r) => !r.same);
  if (args.json) { console.log(JSON.stringify({ source: tsFile, config: configFile, rows, drift: drift.length }, null, 2)); }
  else {
    for (const r of rows) console.log(`${r.same ? "ok   " : "DRIFT"} ${r.key}\n      config: ${r.have}\n      site:   ${r.want}`);
  }
  if (args.write && drift.length) {
    for (const r of drift) setPath(config, r.key, r.want);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
    console.log(`wrote ${drift.length} value(s) to ${configFile}; rebuild the packs.`);
    return;
  }
  if (args.check && drift.length) { console.error(`sync-facts: ${drift.length} value(s) drifted from ${tsFile}; run with --write`); process.exit(1); }
  if (!args.json) console.log(drift.length ? `${drift.length} drifted` : "no drift");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
