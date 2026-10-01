/**
 * HTML → PDF via headless Chromium (Playwright). Renders exactly what the
 * live site can (web fonts, gradients, grid, backdrop-filter), which is the
 * visual ceiling WeasyPrint can't reach.
 *
 * Playwright is imported dynamically and the browser is launched on demand, so
 * a deployment without Chromium does not crash the server — callers get a
 * typed PdfRendererUnavailableError to map to a 503. A single browser instance
 * is reused across requests (MSP-scale PDF volume).
 */

export class PdfRendererUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRendererUnavailableError";
  }
}

type Browser = any;
let browserPromise: Promise<Browser> | null = null;

function chromiumExecutablePath(): string | undefined {
  // Honor an explicit override, else let Playwright resolve its own install.
  return process.env.PDF_CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected?.()) return b;
    browserPromise = null;
  }
  browserPromise = (async () => {
    let chromium: any;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      try {
        ({ chromium } = await import("playwright-core"));
      } catch {
        throw new PdfRendererUnavailableError(
          "PDF rendering requires Playwright/Chromium, which is not installed in this environment.",
        );
      }
    }
    try {
      return await chromium.launch({
        executablePath: chromiumExecutablePath(),
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
    } catch (err: any) {
      throw new PdfRendererUnavailableError(
        `Failed to launch Chromium for PDF rendering: ${err?.message || err}`,
      );
    }
  })();
  return browserPromise;
}

export interface RenderPdfOptions {
  format?: "Letter" | "A4";
}

/** Render a full HTML document string to a PDF Buffer. */
export async function renderHtmlToPdf(html: string, opts: RenderPdfOptions = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => undefined);
    const pdf = await page.pdf({
      format: opts.format || "Letter",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Best-effort shutdown (e.g. on process exit). */
export async function closePdfRenderer(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  await b?.close?.().catch(() => undefined);
}
