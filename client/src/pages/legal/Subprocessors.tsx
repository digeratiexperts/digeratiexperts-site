import source from "./content/P-06-subprocessor-list.md?raw";
import { LegalPolicyPage } from "./LegalPolicyPage";

export default function Subprocessors() {
  return (
    <LegalPolicyPage
      title="Subprocessor List"
      description="Service providers that may process client personal data for Digerati Experts."
      canonical="/legal/subprocessors"
      source={source}
    />
  );
}
