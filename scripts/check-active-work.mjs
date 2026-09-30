#!/usr/bin/env node
// Validates .ai/ACTIVE_WORK.yaml, the shared claim register every agent reads
// before touching code. Nothing in CI parsed this file before, so a malformed
// or silently-truncated claim could land on main and mislead every later agent
// (see docs/OPEN-WORK-AUDIT-20260909.md).
//
// Checks, in order of how badly each one bites:
//   1. the file parses at all;
//   2. the shape is what readers assume (claims list, required keys, unique ids);
//   3. no plain scalar contains an unquoted " #", which YAML may read as a
//      comment and truncate — the trap that mangled the `supersedes:` value
//      introduced by PR #199.

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const FILE = '.ai/ACTIVE_WORK.yaml';
const REQUIRED_CLAIM_KEYS = ['id', 'owner', 'subsystem', 'branch', 'base_sha', 'files', 'status', 'started'];

const errors = [];
const fail = (message) => errors.push(message);

const raw = readFileSync(FILE, 'utf8');

let doc;
try {
  doc = parse(raw);
} catch (error) {
  console.error(`${FILE}: does not parse as YAML\n  ${error.message}`);
  process.exit(1);
}

if (!doc || typeof doc !== 'object') {
  console.error(`${FILE}: expected a mapping at the top level`);
  process.exit(1);
}

if (doc.version === undefined) fail('missing top-level `version`');

const claims = doc.claims;
if (!Array.isArray(claims)) {
  console.error(`${FILE}: expected \`claims\` to be a list`);
  process.exit(1);
}

const seen = new Map();
claims.forEach((claim, index) => {
  const where = `claims[${index}]`;

  if (!claim || typeof claim !== 'object') {
    fail(`${where}: expected a mapping`);
    return;
  }

  for (const key of REQUIRED_CLAIM_KEYS) {
    if (claim[key] === undefined || claim[key] === null || claim[key] === '') {
      fail(`${where} (${claim.id ?? 'no id'}): missing required key \`${key}\``);
    }
  }

  if (claim.id !== undefined) {
    if (seen.has(claim.id)) {
      fail(`${where}: duplicate claim id \`${claim.id}\` (also at claims[${seen.get(claim.id)}]) — two agents would hold the same lock`);
    } else {
      seen.set(claim.id, index);
    }
  }

  if (claim.files !== undefined && !Array.isArray(claim.files)) {
    fail(`${where} (${claim.id}): \`files\` must be a list so overlap between claims can be compared`);
  }
});

// A `#` preceded by whitespace inside a plain scalar is ambiguous: depending on
// the parser and the surrounding indentation it can start a comment and drop
// the rest of the value. Quote it or use a block scalar (>- / |-) instead.
raw.split('\n').forEach((line, i) => {
  const match = /^(\s*)([A-Za-z_][\w-]*):[ \t]+(.*)$/.exec(line);
  if (!match) return;

  const [, , key, value] = match;
  const trimmed = value.trim();
  if (!trimmed) return;
  // Quoted and block scalars are already unambiguous.
  if (/^["'>|&*]/.test(trimmed)) return;
  if (!/\s#/.test(trimmed)) return;

  fail(
    `${FILE}:${i + 1}: \`${key}\` is a plain scalar containing " #", which YAML may treat as a comment and truncate. ` +
      `Quote the value or use a block scalar (>-).`
  );
});

if (errors.length > 0) {
  console.error(`${FILE}: ${errors.length} problem${errors.length === 1 ? '' : 's'} found\n`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`${FILE}: OK — ${claims.length} claim${claims.length === 1 ? '' : 's'}, schema and scalar checks passed`);
