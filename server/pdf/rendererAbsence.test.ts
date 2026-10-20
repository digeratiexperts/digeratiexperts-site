import { describe, expect, it } from "vitest";
import { isRendererAbsent } from "./rendererAbsence";

/**
 * The whole value of this predicate is the line it draws. If it drifts wide,
 * a real renderer bug becomes an invisible skip in CI — which is worse than
 * the permanently-red suite it was written to replace. So the "present but
 * failing" half matters more than the "absent" half.
 */
describe("isRendererAbsent", () => {
  it("recognises an engine that is not installed", () => {
    for (const message of [
      "PDF render failed (WeasyPrint: Command failed: python /tmp/de-pdf/render.py; Playwright: Executable doesn't exist at /ms-playwright/chromium/chrome)",
      "weasyprint: not found",
      "spawn weasyprint ENOENT",
      "ModuleNotFoundError: No module named 'weasyprint'",
      "Please run the following command to download new browsers: npx playwright install",
    ]) {
      expect(isRendererAbsent(message), message).toBe(true);
    }
  });

  it("does not excuse an engine that is installed and failing", () => {
    for (const message of [
      "PDF render failed (WeasyPrint: Timeout after 30000ms; Playwright: Navigation timeout of 30000ms exceeded)",
      "Protocol error (Page.printToPDF): Target closed",
      "Invalid CSS declaration at line 12",
      "RangeError: Maximum call stack size exceeded",
      "PDF render failed (WeasyPrint: segmentation fault; Playwright: page crashed)",
      "write EPIPE",
    ]) {
      expect(isRendererAbsent(message), message).toBe(false);
    }
  });

  it("says nothing is absent about an empty message", () => {
    expect(isRendererAbsent("")).toBe(false);
  });
});
