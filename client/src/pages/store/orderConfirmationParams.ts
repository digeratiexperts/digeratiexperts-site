/**
 * Query-param parsing for the post-checkout confirmation page.
 *
 * Wouter v3's `useLocation()` returns the pathname only — the query string
 * must come from `useSearch()` (which omits the leading "?"). Parsing lives
 * here so the real post-checkout URL format is regression-tested.
 */

export interface OrderConfirmationParams {
  orderId: string | null;
  confirmationToken: string | null;
  method: string | null;
}

export function parseOrderConfirmationParams(search: string): OrderConfirmationParams {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const searchParams = new URLSearchParams(normalized);
  return {
    orderId: searchParams.get("orderId") || searchParams.get("session_id"),
    confirmationToken: searchParams.get("ct"),
    method: searchParams.get("method"),
  };
}
