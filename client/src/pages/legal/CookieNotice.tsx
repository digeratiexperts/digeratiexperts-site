import source from "./content/P-03-cookie-and-tracking-notice.md?raw";
import { LegalPolicyPage } from "./LegalPolicyPage";

export default function CookieNotice() {
  return (
    <LegalPolicyPage
      title="Cookie and Tracking Notice"
      description="Cookies, analytics, session replay, and advertising pixels on the Digerati Experts website."
      canonical="/legal/cookie-notice"
      source={source}
    />
  );
}
