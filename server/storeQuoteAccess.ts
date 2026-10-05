import type { StoredQuoteRequest } from "./storeQuoteStore";

/**
 * Who may read a store quote request, and what a client may see of it.
 *
 * Kept out of routes.ts so the decision and the projection are unit-tested
 * (issue #257). The GET, PDF and confirmation routes all use canAccessQuote.
 */

export type QuoteCaller = {
  userId?: string;
  user?: { role?: string; clientId?: string | null; email?: string | null } | null;
};

type QuoteOwnership = { userId: string | null; clientId: string | null; contactEmail: string | null };

/** Admin, the requesting user, the same company, or the contact email on the quote. */
export function canAccessQuote(caller: QuoteCaller, quote: QuoteOwnership) {
  const isAdmin = caller.user?.role === "admin";
  const ownsQuote =
    (caller.userId && quote.userId === caller.userId) ||
    (caller.user?.clientId && quote.clientId === caller.user.clientId) ||
    (caller.user?.email && quote.contactEmail?.toLowerCase() === caller.user.email.toLowerCase());
  return { isAdmin, ownsQuote: !!(isAdmin || ownsQuote) };
}

/**
 * Client-safe projection for the confirmation page: the reference, the contact
 * echo and the PDF link. Requested lines with list prices, assignment,
 * conversion and internal ids never leave the server here.
 */
export function toClientQuote<T>(quote: StoredQuoteRequest, accountTeam: T) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    contactEmail: quote.contactEmail,
    companyName: quote.companyName,
    status: quote.status,
    createdAt: quote.createdAt,
    pdfUrl: `/api/store/quote-requests/${quote.id}/pdf`,
    accountTeam,
  };
}
