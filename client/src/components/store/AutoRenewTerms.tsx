import { Checkbox } from "@/components/ui/checkbox";
import {
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  AUTORENEW_TERMS_VERSION,
  buildAutoRenewTermsText,
  frequencyLabel,
  formatAutoRenewPrice,
  type AutoRenewClientConsent,
  type AutoRenewFrequency,
} from "@shared/autoRenewContract";

export type AutoRenewTermsProps = {
  priceCents: number;
  currency?: string;
  frequency: AutoRenewFrequency;
  termMonths: number;
  pageUrl?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean, consent: AutoRenewClientConsent | null) => void;
  disabled?: boolean;
};

export function buildConsentSnapshot(input: {
  priceCents: number;
  currency?: string;
  frequency: AutoRenewFrequency;
  termMonths: number;
  pageUrl?: string;
  consentedAt?: string;
}): AutoRenewClientConsent {
  const termsTextSnapshot = buildAutoRenewTermsText({
    priceCents: input.priceCents,
    currency: input.currency,
    frequency: input.frequency,
    termMonths: input.termMonths,
  });
  return {
    autoRenewConsentAt: input.consentedAt || new Date().toISOString(),
    termsVersion: AUTORENEW_TERMS_VERSION,
    termsTextSnapshot,
    cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
    checkboxLabelText: AUTO_RENEW_CHECKBOX_LABEL_TEXT,
    pageUrl: input.pageUrl || (typeof window !== "undefined" ? window.location.href : ""),
  };
}

/**
 * Express auto-renew consent: the terms sit directly next to an
 * unchecked-by-default checkbox. The parent owns checked state and must
 * start it as false.
 */
export function AutoRenewTerms({
  priceCents,
  currency = "USD",
  frequency,
  termMonths,
  pageUrl,
  checked,
  onCheckedChange,
  disabled = false,
}: AutoRenewTermsProps) {
  const termsText = buildAutoRenewTermsText({ priceCents, currency, frequency, termMonths });
  const price = formatAutoRenewPrice(priceCents, currency);
  const cadence = frequencyLabel(frequency);

  const handleChange = (next: boolean | "indeterminate") => {
    const isChecked = next === true;
    onCheckedChange(
      isChecked,
      isChecked ? buildConsentSnapshot({ priceCents, currency, frequency, termMonths, pageUrl }) : null,
    );
  };

  return (
    <div
      className="space-y-4 rounded-lg border border-white/15 bg-black/20 p-4"
      data-testid="auto-renew-terms"
    >
      <div>
        <h3 className="text-sm font-semibold text-white">Automatic renewal terms</h3>
        <p className="mt-1 text-sm text-white/70">
          {price} {cadence}, for a {termMonths === 1 ? "1-month" : `${termMonths}-month`} term. This plan renews
          automatically unless you cancel first. Version {AUTORENEW_TERMS_VERSION}.
        </p>
      </div>
      <div
        className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-3 text-base leading-relaxed text-white"
        data-testid="auto-renew-terms-text"
      >
        {termsText}
      </div>
      <p className="text-base leading-relaxed text-white" data-testid="auto-renew-cancel-policy">
        {AUTO_RENEW_CANCEL_POLICY_TEXT}
      </p>
      <label htmlFor="auto-renew-consent" className="flex cursor-pointer items-start gap-3 text-sm text-white">
        <Checkbox
          id="auto-renew-consent"
          checked={checked}
          disabled={disabled}
          onCheckedChange={handleChange}
          data-testid="checkbox-auto-renew-consent"
          className="mt-0.5 border-white/40"
        />
        <span>{AUTO_RENEW_CHECKBOX_LABEL_TEXT}</span>
      </label>
    </div>
  );
}

export { AUTO_RENEW_CHECKBOX_LABEL_TEXT, AUTO_RENEW_CANCEL_POLICY_TEXT, AUTORENEW_TERMS_VERSION };
