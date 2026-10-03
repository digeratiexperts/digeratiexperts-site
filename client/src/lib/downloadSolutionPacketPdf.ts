/**
 * Download a branded solution packet PDF from the public API.
 * Returns an error message string on failure, otherwise null.
 */
export async function downloadSolutionPacketPdf(
  payload: Record<string, unknown>,
  filename = "DE-Your-Solution.pdf",
): Promise<string | null> {
  try {
    const response = await fetch("/api/public/solutions/packet-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/pdf" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let message = "Unable to download the solution PDF.";
      try {
        const data = (await response.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch {
        /* keep default */
      }
      return message;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return null;
  } catch {
    return "Unable to download the solution PDF.";
  }
}
