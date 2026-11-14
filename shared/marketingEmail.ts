/**
 * Commercial email settings shared by the server and the session kit renderer.
 *
 * Every marketing footer carries the business postal address from
 * BUSINESS_POSTAL_ADDRESS. Until a mailing address is set, footers show the
 * placeholder below and the server sends no marketing email at all.
 */
export const BUSINESS_POSTAL_ADDRESS_PLACEHOLDER = "[BUSINESS_POSTAL_ADDRESS]";

export type EmailEnv = Record<string, string | undefined>;

export function businessPostalAddress(env: EmailEnv): string {
  const value = env.BUSINESS_POSTAL_ADDRESS?.trim();
  return value ? value : BUSINESS_POSTAL_ADDRESS_PLACEHOLDER;
}

export function isPostalAddressPlaceholder(address: string): boolean {
  const value = address.trim();
  return value === "" || value.includes(BUSINESS_POSTAL_ADDRESS_PLACEHOLDER);
}
