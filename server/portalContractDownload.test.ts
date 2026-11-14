import { describe, expect, it } from "vitest";

import {
  portalContractDownloadFilename,
  portalContractDownloadHeaders,
  validatePortalContractDownload,
} from "./portalContractDownload";

describe("portal contract download policy", () => {
  it("creates a bounded PDF filename without path or header-control characters", () => {
    const filename = portalContractDownloadFilename(
      `..\\..\\quarterly\r\nContent-Type: text/html\".html`,
      42,
    );

    expect(filename).toBe("html_.html.pdf");
    expect(filename).not.toMatch(/[\r\n"/\\]/);
    expect(filename.length).toBeLessThanOrEqual(94);
    expect(portalContractDownloadFilename("CON.pdf", 42)).toBe("contract-42.pdf");
  });

  it("forces an attachment with non-executable response headers", () => {
    const headers = portalContractDownloadHeaders("agreement.html", 42);

    expect(headers).toMatchObject({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="agreement.html.pdf"',
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": expect.stringContaining("no-store"),
      "Content-Security-Policy": expect.stringContaining("sandbox"),
      "Cross-Origin-Resource-Policy": "same-origin",
    });
  });

  it("accepts PDFs and rejects malformed or active upstream content", () => {
    const valid = validatePortalContractDownload({
      buffer: Buffer.from("prefix%PDF-1.7\ncontract"),
      fileName: "contract.pdf",
    });
    expect(valid.ok).toBe(true);

    expect(validatePortalContractDownload({ buffer: Buffer.alloc(0) })).toEqual({
      ok: false,
      reason: "empty_file",
    });
    expect(validatePortalContractDownload({
      buffer: Buffer.from("<html><script>alert(1)</script></html>"),
    })).toEqual({ ok: false, reason: "not_pdf" });
    expect(validatePortalContractDownload({ buffer: "not-a-buffer" })).toEqual({
      ok: false,
      reason: "invalid_file",
    });

  });
});
