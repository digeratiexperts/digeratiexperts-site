import source from "./content/P-04-ai-use-disclosure.md?raw";
import { LegalPolicyPage } from "./LegalPolicyPage";

export default function AiUseDisclosure() {
  return (
    <LegalPolicyPage
      title="How Digerati Experts Uses AI"
      description="AI use disclosure for DE Desk, calls, the client portal, and Digerati Experts services."
      canonical="/legal/ai-use"
      source={source}
    />
  );
}
