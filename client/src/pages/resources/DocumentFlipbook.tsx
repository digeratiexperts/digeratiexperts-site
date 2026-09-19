import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, FileText, LockKeyhole, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function pageLabel(start: number, pageCount: number, spread: boolean): string {
  if (!spread || start >= pageCount) return `Page ${start} of ${pageCount}`;
  return `Pages ${start}–${Math.min(start + 1, pageCount)} of ${pageCount}`;
}

export function DocumentFlipbook(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const loadingTaskRef = useRef<PdfLoadingTask | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const renderGeneration = useRef(0);

  const [fileName, setFileName] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [pageStart, setPageStart] = useState(1);
  const [isWide, setIsWide] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPageStart((current) => {
      const step = isWide ? 2 : 1;
      const aligned = Math.floor((Math.max(current, 1) - 1) / step) * step + 1;
      return Math.min(aligned, Math.max(1, pageCount));
    });
  }, [isWide, pageCount]);

  useEffect(() => {
    const pdf = documentRef.current;
    if (!pdf || pageCount === 0) return;

    const generation = ++renderGeneration.current;
    let cancelled = false;
    const tasks: PdfRenderTask[] = [];

    const renderPage = async (pageNumber: number, canvas: HTMLCanvasElement | null) => {
      if (!canvas || pageNumber > pageCount) {
        if (canvas) {
          const context = canvas.getContext("2d");
          context?.clearRect(0, 0, canvas.width, canvas.height);
          canvas.style.display = "none";
        }
        return;
      }

      canvas.style.display = "block";
      const page = await pdf.getPage(pageNumber);
      if (cancelled || generation !== renderGeneration.current) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const hostWidth = Math.max(canvas.parentElement?.clientWidth ?? 600, 280);
      const availableWidth = isWide ? Math.max((hostWidth - 18) / 2, 260) : hostWidth;
      const cssWidth = Math.min(availableWidth, 720);
      const cssScale = cssWidth / baseViewport.width;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: cssScale * pixelRatio });
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas rendering is unavailable in this browser.");

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.round(viewport.width / pixelRatio)}px`;
      canvas.style.height = `${Math.round(viewport.height / pixelRatio)}px`;
      context.save();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();

      const task = page.render({ canvasContext: context, viewport });
      tasks.push(task);
      await task.promise;
    };

    setIsRendering(true);
    setError("");

    void Promise.all([
      renderPage(pageStart, leftCanvasRef.current),
      renderPage(isWide ? pageStart + 1 : pageCount + 1, rightCanvasRef.current),
    ])
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "This page could not be rendered.");
        }
      })
      .finally(() => {
        if (!cancelled && generation === renderGeneration.current) setIsRendering(false);
      });

    return () => {
      cancelled = true;
      tasks.forEach((task) => task.cancel?.());
    };
  }, [isWide, pageCount, pageStart]);

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
    setPageStart(1);
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
      setPageStart(1);
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

  const step = isWide ? 2 : 1;
  const canGoPrevious = pageStart > 1;
  const canGoNext = pageStart + step <= pageCount;
  const goPrevious = () => setPageStart((current) => Math.max(1, current - step));
  const goNext = () => setPageStart((current) => Math.min(Math.max(1, pageCount), current + step));

  const onViewerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft" && canGoPrevious) {
      event.preventDefault();
      goPrevious();
    }
    if (event.key === "ArrowRight" && canGoNext) {
      event.preventDefault();
      goNext();
    }
    if (event.key === "Home" && pageCount > 0) {
      event.preventDefault();
      setPageStart(1);
    }
    if (event.key === "End" && pageCount > 0) {
      event.preventDefault();
      const lastStart = isWide ? Math.max(1, pageCount % 2 === 0 ? pageCount - 1 : pageCount) : pageCount;
      setPageStart(lastStart);
    }
  };

  return (
    <section
      id="document-flipbook"
      className="pt-16"
      style={{ scrollMarginTop: "calc(var(--de-nav-offset) + 1rem)" }}
      aria-labelledby="document-flipbook-title"
      onKeyDown={onViewerKeyDown}
    >
      <div
        className="overflow-hidden rounded-3xl border border-de-hairline bg-de-raised"
        style={{ boxShadow: "0 35px 90px -60px rgba(123,108,255,0.75)" }}
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
                <p className="mt-0.5 text-xs text-de-muted-soft">
                  {pageLabel(pageStart, pageCount, isWide)}{isRendering ? " · rendering" : ""}
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
              className="relative overflow-hidden rounded-2xl border border-de-hairline bg-de-bg p-3 shadow-inner sm:p-5"
              tabIndex={0}
              aria-label="PDF flipbook. Use left and right arrow keys to change pages."
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${pageStart}-${isWide ? "spread" : "single"}`}
                  initial={prefersReducedMotion ? false : { opacity: 0.72, rotateY: 4, x: 8 }}
                  animate={{ opacity: 1, rotateY: 0, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0.72, rotateY: -4, x: -8 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
                  className="mx-auto flex w-full items-start justify-center gap-4"
                  style={{ perspective: 1400, minHeight: 288 }}
                >
                  <canvas
                    ref={leftCanvasRef}
                    className="max-w-full rounded-md bg-white shadow-xl"
                    aria-label={`PDF page ${pageStart}`}
                  />
                  <canvas
                    ref={rightCanvasRef}
                    className="hidden rounded-md bg-white shadow-xl md:block"
                    style={{ maxWidth: isWide ? "calc(50% - 9px)" : "100%" }}
                    aria-label={isWide && pageStart + 1 <= pageCount ? `PDF page ${pageStart + 1}` : undefined}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-xs text-de-muted-soft">
              <span>← / → pages</span>
              <span aria-hidden="true">·</span>
              <span>Home / End jump</span>
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