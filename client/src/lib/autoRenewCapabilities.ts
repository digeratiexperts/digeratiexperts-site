/** Public capability flag for the Hub auto-renew contract. Fails closed to off. */
export async function loadAutoRenewContractEnabled(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/api/public/capabilities", { credentials: "include", signal });
    if (!res.ok) return false;
    const data = (await res.json()) as { autoRenewContractEnabled?: unknown };
    return data.autoRenewContractEnabled === true;
  } catch {
    return false;
  }
}
