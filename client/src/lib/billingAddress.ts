/**
 * Staff Pay Now needs a complete US billing address: sales tax is calculated
 * from it (server/services/salesTax.ts, which re-checks the same rules).
 */
export type AddressField = "line1" | "city" | "state" | "postalCode";

/** The address fields still missing or malformed. */
export function missingBillingAddress(data: Partial<Record<AddressField, string>>): AddressField[] {
  const missing: AddressField[] = [];
  if (!data.line1?.trim()) missing.push("line1");
  if (!data.city?.trim()) missing.push("city");
  if (!/^[A-Za-z]{2}$/.test(data.state?.trim() ?? "")) missing.push("state");
  if (!/^\d{5}(-\d{4})?$/.test(data.postalCode?.trim() ?? "")) missing.push("postalCode");
  return missing;
}

export const ADDRESS_ERRORS: Record<AddressField, string> = {
  line1: "Street address is required for Pay Now",
  city: "City is required for Pay Now",
  state: "Use the two-letter state code, e.g. AZ",
  postalCode: "Use a 5-digit ZIP code",
};
