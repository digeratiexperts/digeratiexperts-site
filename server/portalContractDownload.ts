type PortalContractDownloadFile = {
  buffer: Buffer;
  fileName?: unknown;
};

export type PortalContractDownloadValidation =
  | { ok: true; file: PortalContractDownloadFile }
  | { ok: false; reason: "invalid_file" | "empty_file" | "not_pdf" };

const WINDOWS_RESERVED_FILE_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function portalContractDownloadFilename(fileName: unknown, signatureId: number): string {
  const fallback = `contract-${Number.isSafeInteger(signatureId) && signatureId > 0 ? signatureId : "document"}`;
  const suppliedBaseName = String(fileName ?? "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.pdf$/i, "") ?? "";
  let safeBaseName = suppliedBaseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/[ ._-]+$/g, "")
    .replace(/^[ ._-]+/g, "")
    .replace(/[ _]+/g, "_")
    .slice(0, 90)
    .replace(/[ ._-]+$/g, "");

  if (!safeBaseName || WINDOWS_RESERVED_FILE_NAMES.test(safeBaseName)) {
    safeBaseName = fallback;
  }

  return `${safeBaseName}.pdf`;
}

export function validatePortalContractDownload(file: unknown): PortalContractDownloadValidation {
  if (!file || typeof file !== "object" || !Buffer.isBuffer((file as PortalContractDownloadFile).buffer)) {
    return { ok: false, reason: "invalid_file" };
  }

  const typedFile = file as PortalContractDownloadFile;
  if (typedFile.buffer.length === 0) {
    return { ok: false, reason: "empty_file" };
  }
  // ISO 32000 permits the PDF header to appear within the first 1024 bytes.
  const headerWindow = typedFile.buffer.subarray(0, Math.min(1024, typedFile.buffer.length));
  if (!headerWindow.includes(Buffer.from("%PDF-", "ascii"))) {
    return { ok: false, reason: "not_pdf" };
  }

  return { ok: true, file: typedFile };
}

export function portalContractDownloadHeaders(
  fileName: unknown,
  signatureId: number,
): Record<string, string> {
  const safeFileName = portalContractDownloadFilename(fileName, signatureId);
  return {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${safeFileName}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    Pragma: "no-cache",
    "Content-Security-Policy": "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}
