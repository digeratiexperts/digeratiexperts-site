import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PACKAGE_SPEC = "pdfjs-dist@3.11.174";
const EXPECTED_INTEGRITY = "sha512-TdTZPf1trZ8/UFu5Cx/GXB7GZM30LT+wWUNfsi6Bq8ePLnb+woNKtDymI2mxZYBpMbonNFqKmiz684DIfnd8dA==";
const MIN_PDFJS_BYTES = 450_000;
const MIN_WORKER_BYTES = 1_200_000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "client", "public", "vendor", "pdfjs");
const temp = await mkdtemp(path.join(tmpdir(), "de-pdfjs-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const tarCommand = process.platform === "win32" ? "tar.exe" : "tar";

// Node 20.12+/22+/24 refuse to spawnSync a .cmd shim without a shell (the
// CVE-2024-27980 fix), so `npm.cmd` throws EINVAL on Windows and takes the
// prebuild hook — and therefore `npm run build` — down with it. Route through
// the shell on win32, quoting anything that could carry a space.
const needsShell = process.platform === "win32";

function run(command, args, options = {}) {
  // Only the .cmd shim needs the shell; tar is a real executable, so it spawns
  // directly and stays clear of shell quoting (and of Node's DEP0190 warning).
  const useShell = needsShell && command.endsWith(".cmd");
  const spawnArgs = useShell ? args.map((arg) => (/[\s"]/.test(arg) ? `"${arg}"` : arg)) : args;
  const result = spawnSync(command, spawnArgs, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    windowsHide: true,
    shell: useShell,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

try {
  const output = run(npmCommand, [
    "pack",
    PACKAGE_SPEC,
    "--ignore-scripts",
    "--json",
    "--pack-destination",
    temp,
  ]);
  const metadata = JSON.parse(output);
  const packed = Array.isArray(metadata) ? metadata[0] : null;
  if (!packed?.filename || packed.integrity !== EXPECTED_INTEGRITY) {
    throw new Error(`PDF.js package integrity mismatch. Expected ${EXPECTED_INTEGRITY}, received ${packed?.integrity ?? "none"}.`);
  }

  // Extract from inside the temp directory with a relative archive name. An
  // absolute Windows path here would carry a drive-letter colon, which GNU tar
  // (the tar on PATH under Git Bash / MSYS) reads as a remote `host:path` spec
  // and fails on. A bare filename is unambiguous to both GNU tar and bsdtar.
  run(
    tarCommand,
    ["-xzf", packed.filename, "package/build/pdf.js", "package/build/pdf.worker.js", "package/LICENSE"],
    { cwd: temp },
  );

  const sourceRoot = path.join(temp, "package");
  const pdfJs = path.join(sourceRoot, "build", "pdf.js");
  const worker = path.join(sourceRoot, "build", "pdf.worker.js");
  const license = path.join(sourceRoot, "LICENSE");
  const [pdfJsStat, workerStat] = await Promise.all([stat(pdfJs), stat(worker)]);
  if (pdfJsStat.size < MIN_PDFJS_BYTES || workerStat.size < MIN_WORKER_BYTES) {
    throw new Error(`PDF.js package contents look incomplete (${pdfJsStat.size}/${workerStat.size} bytes).`);
  }

  await mkdir(destination, { recursive: true });
  await Promise.all([
    copyFile(pdfJs, path.join(destination, "pdf.js")),
    copyFile(worker, path.join(destination, "pdf.worker.js")),
    copyFile(license, path.join(destination, "LICENSE")),
  ]);

  const readme = [
    "# PDF.js runtime assets",
    "",
    `Generated at build/dev time from the official Mozilla npm package \`${PACKAGE_SPEC}\`.`,
    `Expected npm integrity: \`${EXPECTED_INTEGRITY}\`.`,
    "",
    "The browser loads these files from the site's own origin so the production CSP does not need a third-party script or worker exception.",
    "Do not hand-edit generated pdf.js/pdf.worker.js. Update the pinned package and integrity in scripts/vendor-pdfjs.mjs instead.",
    "",
  ].join("\n");
  await import("node:fs/promises").then(({ writeFile }) => writeFile(path.join(destination, "README.md"), readme, "utf8"));

  const copiedLicense = await readFile(path.join(destination, "LICENSE"));
  if (copiedLicense.length < 1_000) throw new Error("PDF.js license copy is unexpectedly short.");

  console.log(`[vendor-pdfjs] ${PACKAGE_SPEC} ready (${pdfJsStat.size} B engine, ${workerStat.size} B worker)`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
