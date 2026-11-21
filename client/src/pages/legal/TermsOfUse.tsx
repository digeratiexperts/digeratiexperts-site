import source from "./content/P-01-website-terms-of-use.md?raw";
import { LegalPolicyPage } from "./LegalPolicyPage";

export default function TermsOfUse() {
  return (
    <LegalPolicyPage
      title="Website and Portal Terms of Use"
      description="Terms of Use for the Digerati Experts website, client portal, DE Desk chat, and DE Store pages."
      canonical="/legal/terms-of-use"
      source={source}
    />
  );
}
