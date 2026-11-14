import source from "./content/P-02-privacy-policy.md?raw";
import { LegalPolicyPage } from "./LegalPolicyPage";

/**
 * The #chat-recording slot wraps P-02 sections 6 and 7 (DE Desk chat and
 * phone calls). Additional approved recording subsections from the open
 * DE Desk disclosure work belong in this same slot.
 */
export default function PrivacyPolicy() {
  return (
    <LegalPolicyPage
      title="Privacy Policy"
      description="How Digerati Experts collects, uses, shares, and protects personal information."
      canonical="/legal/privacy-policy"
      source={source}
      wrap={[
        {
          fromHeading: "6. DE Desk chat and the homepage service matcher",
          untilHeading: "8. Marketing email, calls and texts",
          id: "chat-recording",
        },
      ]}
    />
  );
}
