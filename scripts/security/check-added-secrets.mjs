#!/usr/bin/env node
// Fails when the diff between BASE and HEAD *adds* a line that looks like a
// secret. Only added lines are read, so the check costs seconds and does not
// re-flag anything already in history. Same detectors as Intelligence-Hub's
// scripts/security/scan-current-secrets.mjs.
//
// Usage: node scripts/security/check-added-secrets.mjs <base-sha> [head-sha]

import { execFileSync } from "node:child_process";

const [base, head = "HEAD"] = process.argv.slice(2);
if (!base || /^0+$/.test(base)) {
  console.log("Secret diff check skipped: no base commit (new branch or first push).");
  process.exit(0);
}

const skipPath = /(?:^|\/)(?:node_modules|dist|build|coverage|playwright-report)(?:\/|$)|\.(?:png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip|gz|tgz|glb|mp4|webm)$|(?:^|\/)package-lock\.json$/i;
const allowedPlaceholder = /(?:process\.env|import\.meta\.env|\$\{|secrets\.|placeholder|changeme|example|dummy|fixture|redacted|<[^>]+>)/i;

const detectors = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "known token prefix",
    regex: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[ousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk_live_[0-9A-Za-z]{20,}|rk_live_[0-9A-Za-z]{20,})\b/g,
  },
  // Zoho OAuth grant/refresh/access tokens: 1000.<32 hex>.<32 hex>
  { name: "Zoho OAuth token", regex: /\b1000\.[0-9a-f]{32}\.[0-9a-f]{32}\b/g },
  {
    name: "hard-coded sensitive assignment",
    regex: /(?<![\w.:/-])(?:client[_-]?secret|api[_-]?secret|access[_-]?token|refresh[_-]?token|private[_-]?key|webhook[_-]?secret|signing[_-]?secret|password)\b["']?\s*[:=]\s*["']([^"'\n]{16,})["']/gi,
    capture: 1,
  },
];

const diff = execFileSync(
  "git",
  ["diff", "--no-color", "--no-ext-diff", "--unified=0", "--diff-filter=AMR", base, head],
  { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
);

const findings = [];
let file = null;
let line = 0;
for (const raw of diff.split("\n")) {
  if (raw.startsWith("+++ ")) {
    file = raw.startsWith("+++ b/") ? raw.slice(6) : null;
    continue;
  }
  const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
  if (hunk) {
    line = Number(hunk[1]);
    continue;
  }
  if (!file || skipPath.test(file)) continue;
  if (raw.startsWith("+")) {
    const text = raw.slice(1);
    for (const detector of detectors) {
      detector.regex.lastIndex = 0;
      for (const match of text.matchAll(detector.regex)) {
        const candidate = detector.capture ? match[detector.capture] : match[0];
        if (allowedPlaceholder.test(candidate)) continue;
        findings.push(`${file}:${line} (${detector.name})`);
      }
    }
    line += 1;
  }
}

if (findings.length) {
  console.error("This change adds what looks like a secret:");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error("Remove it, rotate it if it was real, and load it from the server env / secret store instead.");
  process.exit(1);
}
console.log(`Secret diff check passed (${base.slice(0, 8)}..${head}).`);
