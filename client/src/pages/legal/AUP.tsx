import source from "./content/P-07-acceptable-use-policy.md?raw";
import { LegalPolicyPage } from "./LegalPolicyPage";

export default function AUP() {
  return (
    <LegalPolicyPage
      title="Acceptable Use Policy"
      description="Rules for clients and users of Digerati Experts services, networks, voice, and messaging."
      canonical="/legal/aup"
      source={source}
    />
  );
}
