/**
 * HTML → PDF for Store client packets.
 *
 * Primary: WeasyPrint (same pattern as Hub signature-doc-renderer).
 * Fallback: Playwright Chromium page.pdf() when WeasyPrint/native libs
 * are unavailable (common on Windows workstations; VPS until WeasyPrint is installed).
 *
 * Ops: either `pip install weasyprint` (+ system pango/cairo) with optional
 * PYTHON_BIN, or ensure `playwright` is installed and Chromium is available
 * (`npx playwright install chromium` or PDF_CHROMIUM_PATH).
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RENDER_TIMEOUT_MS = 60_000;
const MIN_PDF_BYTES = 1_500;

export class PdfRendererUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRendererUnavailableError";
  }
}

const PY_RUNNER = `import sys, os
from weasyprint import HTML, default_url_fetcher

def _no_remote(url):
    if url.startswith(("http://", "https://")):
        return {"string": b"", "mime_type": "text/css"}
    return default_url_fetcher(url)

src, out = sys.argv[1], sys.argv[2]
doc = HTML(filename=src, url_fetcher=_no_remote)
try:
    # Tagged PDF (structure for screen readers); WeasyPrint 63+.
    doc.write_pdf(out, pdf_tags=True)
except TypeError:
    doc.write_pdf(out)
size = os.path.getsize(out) if os.path.exists(out) else 0
if size < ${MIN_PDF_BYTES}:
    sys.stderr.write("pdf too small (%d bytes)\\n" % size)
    sys.exit(4)
sys.stdout.write("ok %d" % size)
`;

function resolvePython(): string {
  const candidates = [
    process.env.PYTHON_BIN,
    process.env.PYTHON,
    "python",
    "py",
    "python3",
  ].filter((c): c is string => Boolean(c));
  for (const c of candidates) {
    if (c === "py" || c === "python" || c === "python3" || existsSync(c)) return c;
  }
  return "python";
}

async function renderWithWeasyPrint(html: string, dir: string): Promise<Buffer> {
  const htmlPath = path.join(dir, "doc.html");
  const pyPath = path.join(dir, "render.py");
  const pdfPath = path.join(dir, "out.pdf");
  await writeFile(htmlPath, html, "utf8");
  await writeFile(pyPath, PY_RUNNER, "utf8");
  const python = resolvePython();
  const args = python === "py" ? ["-3", pyPath, htmlPath, pdfPath] : [pyPath, htmlPath, pdfPath];
  await execFileAsync(python, args, { timeout: RENDER_TIMEOUT_MS });
  const buf = await readFile(pdfPath);
  if (buf.byteLength < MIN_PDF_BYTES) {
    throw new Error(`WeasyPrint PDF too small (${buf.byteLength} bytes)`);
  }
  return buf;
}

async function renderWithPlaywright(html: string): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const executablePath = process.env.PDF_CHROMIUM_PATH?.trim() || undefined;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: RENDER_TIMEOUT_MS });
    // The document's @page rules set size and margins (running header and
    // footer); tagged + outline give screen readers structure and bookmarks.
    const buf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      outline: true,
    });
    if (buf.byteLength < MIN_PDF_BYTES) {
      throw new Error(`Playwright PDF too small (${buf.byteLength} bytes)`);
    }
    return Buffer.from(buf);
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * A FIFO concurrency limiter. A released slot is handed straight to the next
 * waiter, so a new caller can never slip in ahead and exceed the cap.
 */
export function createRenderLimiter(max: number): () => Promise<() => void> {
  const cap = Math.max(1, Math.floor(max) || 1);
  let active = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    const next = queue.shift();
    if (next) next();
    else active -= 1;
  };
  return async () => {
    if (active < cap) {
      active += 1;
    } else {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release();
    };
  };
}

// Each render spawns a Python or Chromium process, and the solution packet
// route is public. Cap concurrent renders so a burst of requests queues
// instead of exhausting the server's memory.
const acquireRenderSlot = createRenderLimiter(Number(process.env.PDF_MAX_CONCURRENT_RENDERS) || 2);

/** Render an HTML string to a PDF buffer. */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const release = await acquireRenderSlot();
  try {
    return await renderHtmlToPdfNow(html);
  } finally {
    release();
  }
}

async function renderHtmlToPdfNow(html: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "de-pdf-"));
  try {
    try {
      return await renderWithWeasyPrint(html, dir);
    } catch (weasyErr) {
      try {
        return await renderWithPlaywright(html);
      } catch (playErr) {
        const weasyMsg = weasyErr instanceof Error ? weasyErr.message : String(weasyErr);
        const playMsg = playErr instanceof Error ? playErr.message : String(playErr);
        throw new PdfRendererUnavailableError(
          `PDF render failed (WeasyPrint: ${weasyMsg}; Playwright: ${playMsg})`,
        );
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
