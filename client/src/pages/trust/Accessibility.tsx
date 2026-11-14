import source from "../legal/content/P-05-accessibility-statement.md?raw";
import { LegalPolicyPage } from "../legal/LegalPolicyPage";

export default function Accessibility() {
  return (
    <LegalPolicyPage
      title="Accessibility Statement"
      description="Accessibility statement for the Digerati Experts website, client portal, and DE Store."
      canonical="/trust/accessibility"
      source={source}
      eyebrow="Trust"
      breadcrumbs={[
        { label: "Trust", href: "/trust/trust-center" },
        { label: "Accessibility Statement" },
      ]}
    />
  );
}
