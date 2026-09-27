/** True only when the public availability payload explicitly enables card checkout. */
export function cardCheckoutFromAvailability(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  return (payload as { cardCheckout?: unknown }).cardCheckout === true;
}

/** Fail closed: a missing or failed status means card checkout must not be offered. */
export async function loadCardCheckoutAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/payments/availability", { credentials: "same-origin" });
    if (!response.ok) return false;
    return cardCheckoutFromAvailability(await response.json());
  } catch {
    return false;
  }
}
