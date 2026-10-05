// Store PDF regression check. Renders every sample in storePdfCases.ts through
// the production pipeline (renderHtmlToPdf -> finalizePdf), then checks each PDF:
//   - layout: page count (short documents stay on one page, long ones paginate),
//     and the "Next step" close never sits alone on the last page;
//   - content: expected text extracts, redacted text is absent, no template
//     leaks ("undefined", "NaN", entities) and no account lifecycle values;
//   - metadata: title matches the HTML title, every link has a text alternative,
//     size within budget;
//   - structure (scripts/de-documents/lib/verify.py, shared with the resource
//     PDFs): tagged, fonts embedded with ToUnicode and no Type 3, no untagged
//     painting, no split words, and veraPDF PDF/UA-1 when VERAPDF is set.
// Writes the PDFs, page previews (PNG), report.json and summary.md to the out
// dir, and appends the summary to $GITHUB_STEP_SUMMARY in CI.
//
// Usage: npx tsx scripts/qa/store-pdf-check.mts [--require-verapdf] [--only=a,b] [out-dir]
// Needs poppler-utils (pdftotext, pdffonts, pdftoppm) and Python pikepdf.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { htmlTitle } from "../../server/pdf/finalizePdf";
import { renderHtmlToPdf } from "../../server/pdf/renderHtmlToPdf";
import { storePdfCases } from "./storePdfCases";
import { closeAloneOnLastPage, describePages, formatKb, pageProblem, parseVerifyOutput, textProblems } from "./storePdfChecks";

/** Per-document size budget. Current documents are well under it. */
const MAX_BYTES = 1024 * 1024;

const args = process.argv.slice(2);
const requireVera = args.includes("--require-verapdf");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);
const outDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? mkdtempSync(path.join(tmpdir(), "store-pdf-check-")));
const python = process.env.PYTHON || "python3";

for (const tool of ["pdftotext", "pdftoppm", "pdffonts"]) {
  if (spawnSync(tool, ["-v"], { stdio: "ignore" }).error) {
    console.error(`Missing ${tool}: install poppler-utils (see server/pdf/README.md).`);
    process.exit(2);
  }
}
if (spawnSync(python, ["-c", "import pikepdf"], { stdio: "ignore" }).status !== 0) {
  console.error(`Python pikepdf is missing for ${python}: pip install pikepdf (or apt install python3-pikepdf).`);
  process.exit(2);
}
if (requireVera && !process.env.VERAPDF) {
  console.error("VERAPDF is not set but --require-verapdf was given (scripts/qa/install-verapdf.sh installs it).");
  process.exit(2);
}

let cases = storePdfCases();
if (only) {
  const unknown = only.filter((n) => !cases.some((c) => c.name === n));
  if (unknown.length) {
    console.error(`Unknown case(s): ${unknown.join(", ")}. Known: ${cases.map((c) => c.name).join(", ")}`);
    process.exit(2);
  }
  cases = cases.filter((c) => only.includes(c.name));
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, "previews"), { recursive: true });

interface Row {
  name: string;
  kind: string;
  pages: number;
  expectedPages: string;
  bytes: number;
  title: string;
  pdfua: string;
  fonts: string;
  problems: string[];
}
const rows: Row[] = [];

for (const c of cases) {
  const htmlFile = path.join(outDir, `${c.name}.html`);
  const pdfFile = path.join(outDir, `${c.name}.pdf`);
  writeFileSync(htmlFile, c.html);
  const pdf = await renderHtmlToPdf(c.html);
  writeFileSync(pdfFile, pdf);

  const problems: string[] = [];
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const pages = doc.getPageCount();
  const pp = pageProblem(pages, c.pages);
  if (pp) problems.push(pp);

  const title = doc.getTitle() ?? "";
  if (title !== htmlTitle(c.html)) problems.push(`title "${title}" does not match the HTML title "${htmlTitle(c.html)}"`);
  let bareLinks = 0;
  for (const page of doc.getPages()) {
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const a = doc.context.lookup(ref);
      if (a instanceof PDFDict && a.get(PDFName.of("Subtype")) === PDFName.of("Link") && !a.has(PDFName.of("Contents"))) bareLinks++;
    }
  }
  if (bareLinks) problems.push(`${bareLinks} link(s) without a text alternative`);
  if (pdf.length > MAX_BYTES) problems.push(`${formatKb(pdf.length)} is over the ${formatKb(MAX_BYTES)} budget`);

  const text = execFileSync("pdftotext", ["-enc", "UTF-8", pdfFile, "-"]).toString("utf8");
  problems.push(...textProblems(text, c));
  if (pages > 1) {
    const last = execFileSync("pdftotext", ["-enc", "UTF-8", "-f", String(pages), "-l", String(pages), pdfFile, "-"]).toString("utf8");
    if (closeAloneOnLastPage(last, c.html)) problems.push(`page ${pages} holds only the "Next step" close`);
  }

  execFileSync("pdftoppm", ["-r", "45", "-png", pdfFile, path.join(outDir, "previews", c.name)]);
  rows.push({ name: c.name, kind: c.kind, pages, expectedPages: describePages(c.pages), bytes: pdf.length, title, pdfua: "not run", fonts: "", problems });
}

// Structure, fonts, split words and PDF/UA-1: the resource PDFs' verifier.
const verify = spawnSync(
  python,
  ["scripts/de-documents/lib/verify.py", ...cases.map((c) => `${path.join(outDir, `${c.name}.pdf`)}::${path.join(outDir, `${c.name}.html`)}`)],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
writeFileSync(path.join(outDir, "verify.txt"), verify.stdout + verify.stderr);
const verified = parseVerifyOutput(verify.stdout);
for (const row of rows) {
  const v = verified.get(`${row.name}.pdf`);
  if (!v) {
    row.problems.push(`verify.py gave no result${verify.stderr ? `: ${verify.stderr.trim().split("\n").pop()}` : ""}`);
    continue;
  }
  row.pdfua = v.pdfua;
  row.fonts = v.fonts;
  row.problems.push(...v.problems);
}

const failed = rows.filter((r) => r.problems.length);
const md = [
  `### Store PDF check: ${failed.length ? `${failed.length} of ${rows.length} failed` : `all ${rows.length} passed`}`,
  "",
  "| Document | Pages (expected) | Size | PDF/UA-1 | Fonts | Result |",
  "|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.pages} (${r.expectedPages}) | ${formatKb(r.bytes)} | ${r.pdfua} | ${r.fonts || "?"} | ${r.problems.length ? "❌ " + r.problems.join("; ").replace(/\|/g, "\\|") : "✅"} |`,
  ),
  "",
  `PDFs, HTML sources and page previews are in the \`store-pdfs\` artifact.`,
].join("\n");
writeFileSync(path.join(outDir, "summary.md"), md + "\n");
writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), maxBytes: MAX_BYTES, rows }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");

for (const r of rows) {
  console.log(`${r.problems.length ? "FAIL" : "ok  "} ${r.name}: ${r.pages}p (${r.expectedPages}) · ${formatKb(r.bytes)} · PDF/UA-1 ${r.pdfua}`);
  for (const p of r.problems) console.log(`       - ${p}`);
}
console.log(`\nOutput: ${outDir}`);
if (failed.length) {
  console.error(`\nStore PDF check failed: ${failed.map((r) => r.name).join(", ")}`);
  process.exit(1);
}
