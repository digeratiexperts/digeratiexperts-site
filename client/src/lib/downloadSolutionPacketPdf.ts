/**
 * The branded solution packet PDF (DE-ST-SOL) from the public API: download
 * it, or print it. Print uses the same document as Download, so a printed
 * solution always carries the logo, the next step and the contacts.
 */

const ENDPOINT = "/api/public/solutions/packet-pdf";
const FALLBACK_ERROR = "Unable to download the solution PDF.";

/** Fetches the packet PDF. Throws an Error carrying the server's message. */
export async function fetchSolutionPacketPdf(payload: Record<string, unknown>): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/pdf" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(FALLBACK_ERROR);
  }
  if (!response.ok) {
    let message = FALLBACK_ERROR;
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return response.blob();
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download a branded solution packet PDF from the public API.
 * Returns an error message string on failure, otherwise null.
 */
export async function downloadSolutionPacketPdf(
  payload: Record<string, unknown>,
  filename = "DE-Your-Solution.pdf",
): Promise<string | null> {
  try {
    saveBlob(await fetchSolutionPacketPdf(payload), filename);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : FALLBACK_ERROR;
  }
}

/**
 * How this browser can print a PDF:
 * - "dialog": desktop browsers print a PDF loaded in a hidden frame;
 * - "tab": iOS and iPadOS show the PDF in a new tab (Share → Print);
 * - "download": Android Chrome cannot show or print a PDF inside a page, so
 *   the file downloads and opens in the system viewer, which prints.
 */
/** Shown when the print falls back to a download (Android). */
export const PRINT_DOWNLOADED = "Your PDF downloaded. Open it to print.";

export type PacketPrintMode = "dialog" | "tab" | "download";

export function packetPrintModeFor(userAgent: string, maxTouchPoints = 0): PacketPrintMode {
  if (/Android/i.test(userAgent)) return "download";
  // iPadOS reports a Macintosh user agent; touch points tell it apart.
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "tab";
  return "dialog";
}

function printInHiddenFrame(url: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;";
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };
  frame.src = url;
  document.body.appendChild(frame);
  // The print dialog reads the frame after onload returns; clean up later.
  window.setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120_000);
}

/**
 * Print the branded packet PDF. Call it straight from the click handler: the
 * iOS tab must open before the first await or the popup blocker stops it.
 * Resolves with the mode used, or an error (the caller then prints the page).
 */
export async function printSolutionPacketPdf(
  payload: Record<string, unknown>,
  filename = "DE-Your-Solution.pdf",
): Promise<{ mode: PacketPrintMode } | { error: string }> {
  let mode = packetPrintModeFor(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const tab = mode === "tab" ? window.open("", "_blank") : null;
  if (mode === "tab" && !tab) mode = "download";

  let blob: Blob;
  try {
    blob = await fetchSolutionPacketPdf(payload);
  } catch (error) {
    tab?.close();
    return { error: error instanceof Error ? error.message : FALLBACK_ERROR };
  }

  if (mode === "download") {
    saveBlob(blob, filename);
  } else if (mode === "tab" && tab) {
    tab.location.href = URL.createObjectURL(blob);
  } else {
    printInHiddenFrame(URL.createObjectURL(blob));
  }
  return { mode };
}
