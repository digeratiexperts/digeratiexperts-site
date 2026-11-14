import { escapeEmailHtml } from "./emailEscape";
import { frequencyLabel, formatAutoRenewPrice, type AutoRenewFrequency } from "@shared/autoRenewContract";

export type AutoRenewEmailTerms = {
  termsVersion: string;
  termsText: string;
  cancelPolicyText: string;
  frequency?: AutoRenewFrequency;
  termMonths?: number;
  renewsAt?: string | null;
  currency?: string;
  totalCents?: number;
};

/** Keepable auto-renew and cancellation terms for confirmation emails. */
export function renderAutoRenewTermsEmailSection(terms: AutoRenewEmailTerms): string {
  const lines = terms.termsText
    .split("\n")
    .map((line) => escapeEmailHtml(line))
    .join("<br>");
  const renews = terms.renewsAt
    ? `<p><strong>Next renewal:</strong> ${escapeEmailHtml(terms.renewsAt)}</p>`
    : "";
  const price =
    typeof terms.totalCents === "number"
      ? `<p><strong>Price:</strong> ${escapeEmailHtml(formatAutoRenewPrice(terms.totalCents, terms.currency || "USD"))}${
          terms.frequency ? ` ${escapeEmailHtml(frequencyLabel(terms.frequency))}` : ""
        }</p>`
      : "";
  return `
    <h3>Automatic renewal and cancellation terms</h3>
    ${price}
    ${renews}
    <p><strong>Terms version:</strong> ${escapeEmailHtml(terms.termsVersion)}</p>
    <p style="background:#1a1a2e;padding:15px;border-radius:6px;white-space:pre-wrap;">${lines}</p>
    <p><strong>How to cancel:</strong> ${escapeEmailHtml(terms.cancelPolicyText)}</p>
  `;
}
