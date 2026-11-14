import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { StoreTermsDocument } from "./StoreTermsDocument";

export default function StoreTermsOfSale() {
  return (
    <LegalDocumentLayout
      title="DE Store Terms of Sale"
      subtitle="Draft v2026.10-store. Not published until Joseph approves it."
      description="Terms of sale for the Digerati Experts store."
      canonical="/legal/store-terms-of-sale"
    >
      <StoreTermsDocument />
    </LegalDocumentLayout>
  );
}
