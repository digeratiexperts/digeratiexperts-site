/** Parse the public ticket contract without accepting a malformed success. */
export async function readDeskTicketResponse(response: Response): Promise<{
  ticketNumber: string;
  message: string;
}> {
  const data = await response.json().catch(() => null);
  const deskId = typeof data?.zohoTicketId === "string" && data.zohoTicketId.trim() ? data.zohoTicketId : null;
  // A ticket the Desk API could not take but the server's failover holds
  // (server/deskTicketFallback.ts): received, with the reference it emailed.
  const queuedReference = data?.queued === true && typeof data.ticketNumber === "string" && data.ticketNumber.trim()
    ? data.ticketNumber
    : null;
  if (!response.ok || data?.success !== true || (!deskId && !queuedReference)) {
    const fallback = response.status === 429
      ? "Too many support requests. Please wait a few minutes before trying again. Your details are still here."
      : "We couldn't confirm your ticket. Your details are still here. Please try again or call us for help.";
    throw new Error(typeof data?.error === "string" && data.error.trim() ? data.error : fallback);
  }
  return {
    ticketNumber: queuedReference ?? (typeof data.ticketNumber === "string" && data.ticketNumber.trim() ? data.ticketNumber : deskId!),
    message: "Your support request has been received.",
  };
}
