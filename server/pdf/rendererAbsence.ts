/**
 * Is a PDF render failure the engine being missing, or the engine being broken?
 *
 * `renderHtmlToPdf` raises `PdfRendererUnavailableError` whenever BOTH
 * WeasyPrint and Playwright fail, whatever the reason. That conflates two very
 * different situations:
 *
 *   - neither engine is installed, which is normal on a contributor's machine
 *     and in the agent sandbox, and says nothing about our code;
 *   - an engine is installed and failing on our document, which is a bug.
 *
 * Tests that exercise real rendering use this to skip the first case and stay
 * red for the second. Without the distinction the only honest options are a
 * suite that is permanently red in every environment but CI — which teaches
 * people to ignore red — or a blanket skip that would hide a genuine renderer
 * bug. Neither is acceptable, so the message is read.
 *
 * Matching on message text is not ideal, but the engines are separate
 * processes and their absence only ever reaches us as a string.
 */

/** Shapes that mean "this engine is not installed here". */
const ABSENT_SIGNALS: readonly RegExp[] = [
  /not found/i, // `weasyprint: not found`
  /\bENOENT\b/, // spawn weasyprint ENOENT
  /No module named/i, // python -c "import weasyprint"
  /Executable doesn't exist/i, // Playwright, browser never downloaded
  /playwright install/i, // Playwright's own remedy line
  /command failed: python/i, // the render.py shim cannot start
];

/**
 * True only when the failure reads as a missing engine. A timeout, a crash, a
 * protocol error or a malformed document all return false, so the caller keeps
 * failing on them.
 */
export function isRendererAbsent(message: string): boolean {
  return ABSENT_SIGNALS.some((pattern) => pattern.test(message));
}
