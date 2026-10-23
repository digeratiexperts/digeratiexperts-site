// Node wrapper for signcheck — call this from the portal's upload handler.
//
//   import { checkSignature, decide } from "./signcheck.mjs";
//   const report = await checkSignature(tempPath, { originalName: file.originalname });
//   const action = decide(report);   // "publish" | "warn" | "quarantine"
//
// Environment (server settings, never client code):
//   SIGNCHECK_PYTHON      python binary inside the signcheck venv
//                         (default /opt/de-signcheck/venv/bin/python)
//   SIGNCHECK_SCRIPT      path to signcheck.py (default: next to this file)
//   SIGNCHECK_PUBLISHERS  path to trusted-publishers JSON (optional)

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = process.env.SIGNCHECK_PYTHON || "/opt/de-signcheck/venv/bin/python";
const SCRIPT = process.env.SIGNCHECK_SCRIPT || path.join(here, "signcheck.py");

/**
 * Scan one uploaded file.
 * @param {string} filePath  path of the stored upload
 * @param {{originalName?: string, publishersFile?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<{exitCode:number, result:object, raw:object}>}
 */
export function checkSignature(filePath, opts = {}) {
  const args = [SCRIPT, "--json"];
  const publishers = opts.publishersFile ?? process.env.SIGNCHECK_PUBLISHERS;
  if (publishers) args.push("--trusted-publishers", publishers);
  if (opts.originalName) args.push("--name", opts.originalName);
  args.push(filePath);

  return new Promise((resolve, reject) => {
    execFile(
      PYTHON,
      args,
      { timeout: opts.timeoutMs ?? 120_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        // Exit codes 0, 10 and 20 are normal results with JSON on stdout.
        const code = err ? (typeof err.code === "number" ? err.code : -1) : 0;
        if (![0, 10, 20].includes(code)) {
          return reject(new Error(`signcheck failed (exit ${code}): ${stderr || err?.message}`));
        }
        try {
          const raw = JSON.parse(stdout);
          resolve({ exitCode: code, result: raw.results[0], raw });
        } catch (e) {
          reject(new Error(`signcheck returned unreadable output: ${e.message}`));
        }
      },
    );
  });
}

/**
 * Turn a scan into the portal's action. Fail closed: anything unexpected quarantines.
 *  - publish:    trusted signature, or not an executable at all
 *  - warn:       unsigned or unlisted publisher — DE staff must confirm before publishing
 *  - quarantine: invalid/tampered signature, disguised file type, unscannable archive, errors
 */
export function decide(report) {
  switch (report?.result?.verdict) {
    case "trusted":
    case "not_executable":
      return "publish";
    case "unsigned":
    case "signed_unlisted":
      return "warn";
    default:
      return "quarantine";
  }
}
