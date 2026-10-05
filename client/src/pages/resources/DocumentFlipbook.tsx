import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, FileText, LockKeyhole, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageFlip } from "@/lib/pageFlip";
import "@/styles/page-flip.css";

type PdfViewport = { width: number; height: number };
type PdfRenderTask = { promise: Promise<void>; cancel?: () => void };
type PdfPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask;
};
type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy?: () => Promise<void> | void;
};
type PdfLoadingTask = {
  promise: Promise<PdfDocument>;
  destroy?: () => Promise<void> | void;
};
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { data: Uint8Array; isEvalSupported: boolean }) => PdfLoadingTask;
};

declare global {
  interface Window {
    pdfjsLib?: PdfJs;
  }
}

const PDFJS_SCRIPT = "/vendor/pdfjs/pdf.js";
const PDFJS_WORKER = "/vendor/pdfjs/pdf.worker.js";
const MAX_PDF_BYTES = 75 * 1024 * 1024;
let pdfJsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return Promise.resolve(window.pdfjsLib);
  }
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise<PdfJs>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PDFJS_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");

    const ready = () => {
      if (!window.pdfjsLib) {
        pdfJsPromise = null;
        reject(new Error("PDF engine loaded without exposing pdfjsLib."));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };

    const failed = () => {
      pdfJsPromise = null;
      reject(new Error("The local PDF engine could not be loaded."));
    };

    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", failed, { once: true });

    if (!existing) {
      script.src = PDFJS_SCRIPT;
      script.async = true;
      script.dataset.dePdfjs = "true";
      document.head.appendChild(script);
    }
  });

  return pdfJsPromise;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function looksLikeOfficeDocument(file: File): boolean {
  return /\.(doc|docx|ppt|pptx)$/i.test(file.name);
}

export function DocumentFlipbook(): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  // The flip engine owns the DOM inside this host: two static sides, a turning
  // leaf, and the lighting layers. React does not render into it, which is why
  // the host carries no children in JSX.
  const bookHostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const loadingTaskRef = useRef<PdfLoadingTask | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const renderGeneration = useRef(0);

  const [fileName, setFileName] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  // Mirrors the engine's position so the toolbar and the page label stay in
  // step with it. The engine is the single source of truth for which pages are
  // showing — it knows about leaves, spreads and the lone cover; React does not.
  const [flipState, setFlipState] = useState({ leaf: 0, leaves: 0, label: "" });

  // Build the flip engine once per document. It owns the page DOM from here, so
  // this effect only hands it one renderer per page and lets it ask for what it
  // needs; it calls them lazily, so a long PDF does not rasterise up front.
  useEffect(() => {
    const pdf = documentRef.current;
    const host = bookHostRef.current;
    if (!pdf || pageCount === 0 || !host) return;

    const generation = ++renderGeneration.current;
    let cancelled = false;
    const tasks: PdfRenderTask[] = [];

    /**
     * Draw one PDF page into a canvas. Returns the canvas immediately and fills
     * the bitmap in after, because the engine needs an element the moment it
     * mounts a slot — a promise would leave a hole in the book mid-turn.
     */
    const renderPageCanvas = (pageNumber: number): HTMLCanvasElement => {
      const canvas = document.createElement("canvas");
      canvas.className = "rounded-[3px] bg-white";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Page ${pageNumber} of ${pageCount}`);

      void (async () => {
        try {
          const page = await pdf.getPage(pageNumber);
          if (cancelled || generation !== renderGeneration.current) return;

          const baseViewport = page.getViewport({ scale: 1 });
          // Size off the slot the canvas will occupy, not the whole host: in a
          // spread each page gets half the book.
          const hostWidth = Math.max(host.clientWidth, 280);
          const slotWidth = host.clientWidth >= 820 ? hostWidth / 2 : hostWidth;
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({
            scale: (Math.min(slotWidth, 720) / baseViewport.width) * pixelRatio,
          });

          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas rendering is unavailable in this browser.");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          context.save();
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.restore();

          const task = page.render({ canvasContext: context, viewport });
          tasks.push(task);
          await task.promise;
        } catch (reason: unknown) {
          // A cancelled render is expected when a new file is chosen mid-draw,
          // so only a real failure reaches the user.
          if (!cancelled && generation === renderGeneration.current) {
            setError(reason instanceof Error ? reason.message : "This page could not be rendered.");
          }
        }
      })();

      return canvas;
    };

    setIsRendering(true);
    setError("");

    const flip = new PageFlip(host, {
      pages: Array.from({ length: pageCount }, (_, i) => () => renderPageCanvas(i + 1)),
      onChange: (state) => setFlipState(state),
      // The toolbar below already shows this label, and it sits next to the
      // file name where a reader looks for it. One live region, not two.
      status: false,
    });
    flipRef.current = flip;
    setIsRendering(false);

    return () => {
      cancelled = true;
      tasks.forEach((task) => task.cancel?.());
      flip.destroy();
      flipRef.current = null;
    };
  }, [pageCount]);

  useEffect(() => {
    return () => {
      renderGeneration.current += 1;
      void loadingTaskRef.current?.destroy?.();
      void documentRef.current?.destroy?.();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const clearCurrentDocument = async () => {
    renderGeneration.current += 1;
    await loadingTaskRef.current?.destroy?.();
    await documentRef.current?.destroy?.();
    loadingTaskRef.current = null;
    documentRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setOriginalUrl("");
    setPageCount(0);
    setFlipState({ leaf: 0, leaves: 0, label: "" });
  };

  const loadFile = async (file: File) => {
    setError("");

    if (looksLikeOfficeDocument(file)) {
      setError("Word and PowerPoint files need to be exported as PDF first. This viewer does not upload your document to a conversion service.");
      return;
    }
    if (!isPdf(file)) {
      setError("Choose a PDF file. Word and PowerPoint documents can be exported to PDF before opening them here.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("This PDF is larger than 75 MB. Use a smaller or optimized PDF so the browser can render it safely.");
      return;
    }

    setIsLoading(true);
    try {
      await clearCurrentDocument();
      const pdfjs = await loadPdfJs();
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
      loadingTaskRef.current = loadingTask;
      const pdf = await loadingTask.promise;
      documentRef.current = pdf;
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setOriginalUrl(objectUrl);
      setFileName(file.name);
      setPageCount(pdf.numPages);
    } catch (reason: unknown) {
      await clearCurrentDocument();
      setFileName("");
      setError(reason instanceof Error ? reason.message : "The PDF could not be opened.");
    } finally {
      setIsLoading(false);
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadFile(file);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  // The engine is authoritative: it knows about leaves, spreads and the lone
  // cover, so the toolbar asks it rather than recomputing page arithmetic here.
  const canGoPrevious = flipState.leaf > 0;
  const canGoNext = flipState.leaves > 0 && flipState.leaf < flipState.leaves - 1;
  const goPrevious = () => flipRef.current?.prev();
  const goNext = () => flipRef.current?.next();

  // The engine binds the same keys on its own focusable book element. This
  // handler covers the case where focus is on the outer section instead, and
  // delegates rather than duplicating the page arithmetic — the engine is the
  // one that knows where the leaves are.
  const onViewerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const flip = flipRef.current;
    if (!flip || pageCount === 0) return;

    const actions: Record<string, () => void> = {
      ArrowLeft: () => flip.prev(),
      ArrowRight: () => flip.next(),
      Home: () => flip.goToLeaf(0),
      End: () => flip.goToLeaf(Number.MAX_SAFE_INTEGER), // clamped by the engine
    };

    const run = actions[event.key];
    if (run) {
      event.preventDefault();
      run();
    }
  };

  return (
    <section
      id="document-flipbook"
      style={{ scrollMarginTop: "calc(var(--de-nav-offset) + 1rem)" }}
      aria-labelledby="document-flipbook-title"
      onKeyDown={onViewerKeyDown}
    >
      <div
        className="overflow-hidden rounded-2xl border border-de-hairline bg-de-raised"
      >
        <div className="grid gap-8 border-b border-de-hairline px-5 py-8 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-10">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border border-de-hairline bg-de-bg px-3 py-1.5 text-xs font-semibold uppercase text-de-accent-ink"
              style={{ letterSpacing: "0.14em" }}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Browser-local viewer
            </div>
            <h2
              id="document-flipbook-title"
              className="mt-4 font-heading text-3xl font-semibold text-white sm:text-4xl"
              style={{ letterSpacing: "-0.035em" }}
            >
              Digital Document Flipbook
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-de-muted-soft">
              Open a PDF and read it like a responsive book. On larger screens you get a two-page spread; phones use one page at a time.
            </p>
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-de-hairline bg-de-bg p-4 text-sm leading-6 text-de-muted-soft">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
              <p>
                <strong className="font-semibold text-white">Private by design:</strong> the selected PDF is read and rendered in your browser. It is not uploaded to Digerati Experts.
              </p>
            </div>
          </div>

          <div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition"
            style={{
              minHeight: 208,
              borderColor: dragActive ? "rgba(154,139,255,0.9)" : "rgba(255,255,255,0.2)",
              background: dragActive ? "rgba(123,108,255,0.12)" : "rgba(255,255,255,0.035)",
            }}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" aria-label="Choose a document to open in the flipbook" accept="application/pdf,.pdf,.doc,.docx,.ppt,.pptx" className="sr-only" onChange={onInputChange} />
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-de-hairline bg-de-bg text-de-accent-ink">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-semibold text-white">Drop a PDF here</p>
            <p className="mt-1 text-sm text-de-muted-soft">or choose one from this device · up to 75 MB</p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 border-de-hairline bg-de-bg text-white hover:bg-white/10 hover:text-white"
              onClick={() => inputRef.current?.click()}
              disabled={isLoading}
            >
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
              {isLoading ? "Opening PDF…" : "Choose document"}
            </Button>
            <p className="mt-4 max-w-md text-xs leading-5 text-de-muted-soft">
              Word or PowerPoint? Export it to PDF first. We deliberately do not send Office files to a third-party converter.
            </p>
          </div>
        </div>

        {error && (
          <div className="border-b border-de-hairline bg-de-bg px-5 py-3 text-sm text-red-200 sm:px-8 lg:px-10" role="alert">
            {error}
          </div>
        )}

        {pageCount > 0 ? (
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white" title={fileName}>{fileName}</p>
                <p className="mt-0.5 text-xs text-de-muted-soft" role="status" aria-live="polite">
                  {flipState.label}{isRendering ? " · rendering" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {originalUrl && (
                  <a
                    href={originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-de-hairline px-3 text-xs font-semibold text-de-muted-soft transition hover:bg-white/10 hover:text-white"
                  >
                    Original
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-de-hairline bg-de-bg text-white hover:bg-white/10 hover:text-white"
                  onClick={goPrevious}
                  disabled={!canGoPrevious}
                  aria-label="Previous page"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-de-hairline bg-de-bg text-white hover:bg-white/10 hover:text-white"
                  onClick={goNext}
                  disabled={!canGoNext}
                  aria-label="Next page"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div
              /* No overflow clip. A leaf rotating under perspective genuinely
                 projects past the page block, the way a real page rises off the
                 book; clipping it would shear the leaf off mid-turn, which is
                 the one moment this engine exists to show. */
              className="relative rounded-2xl border border-de-hairline bg-de-bg p-3 shadow-inner sm:p-5"
              tabIndex={0}
              aria-label="PDF flipbook. Use left and right arrow keys to change pages."
            >
              {/* The engine owns everything inside this host: the two static
                  sides, the turning leaf and the lighting layers. Childless in
                  JSX on purpose — React must not reconcile nodes the engine is
                  mid-animation on. */}
              <div ref={bookHostRef} style={{ minHeight: 288 }} />
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-xs text-de-muted-soft">
              <span>← / → pages</span>
              <span aria-hidden="true">·</span>
              <span>Home / End jump</span>
              <span aria-hidden="true">·</span>
              <span>drag a page corner</span>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-center px-5 py-10 text-center text-sm text-de-muted-soft"
            style={{ minHeight: 160 }}
          >
            Choose a PDF above to start the flipbook.
          </div>
        )}
      </div>
    </section>
  );
}

export default DocumentFlipbook;