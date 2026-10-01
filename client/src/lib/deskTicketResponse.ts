/** Parse the public ticket contract without accepting a malformed success. */
export async function readDeskTicketResponse(response: Response): Promise<{
  ticketNumber: string;
  message: string;
}> {
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true ||
      typeof data.zohoTicketId !== "string" || !data.zohoTicketId.trim()) {
    const fallback = response.status === 429
      ? "Too many support requests. Please wait a few minutes before trying again. Your details are still here."
      : "We couldn't confirm your ticket. Your details are still here. Please try again or call us for help.";
    throw new Error(typeof data?.error === "string" && data.error.trim() ? data.error : fallback);
  }
  return {
    ticketNumber: typeof data.ticketNumber === "string" && data.ticketNumber.trim()
      ? data.ticketNumber : data.zohoTicketId,
    message: "Your support request has been received.",
  };
}
