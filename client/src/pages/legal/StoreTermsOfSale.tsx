import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import {
  EXCLUDED_STATES_PLACEHOLDER,
  POSTAL_ADDRESS_PLACEHOLDER,
  SHIPPING_PROMISE,
  WHERE_WE_SELL_ADDRESS_STEP_TEMPLATE,
} from "@shared/deStoreLegalCopy";

export default function StoreTermsOfSale() {
  return (
    <LegalDocumentLayout
      title="DE Store Terms of Sale"
      subtitle="Draft v2026.10-store. Not published until Joseph approves it."
      description="Terms of sale for the Digerati Experts store."
      canonical="/legal/store-terms-of-sale"
    >
      <p className="mb-8 text-lg leading-relaxed text-[#3A3448]">
        These Store Terms of Sale apply to purchases from the Digerati Experts store. They work together with the DE Master Services Agreement, including Exhibit I (DE Store and Self-Serve Terms).
      </p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Where we sell</h2>
      <p className="text-[#3A3448] leading-relaxed mb-8">{WHERE_WE_SELL_ADDRESS_STEP_TEMPLATE}</p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Shipping promise</h2>
      <p className="text-[#3A3448] leading-relaxed mb-8">{SHIPPING_PROMISE}</p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Mailing address</h2>
      <p className="text-[#3A3448] leading-relaxed">
        Public pages stay city-only (Chandler, Arizona). The postal address for notices and warranty mail is {POSTAL_ADDRESS_PLACEHOLDER}. The excluded-states list is {EXCLUDED_STATES_PLACEHOLDER} until Joseph sets it.
      </p>
    </LegalDocumentLayout>
  );
}
