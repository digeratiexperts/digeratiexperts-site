import { describe, expect, it } from "vitest";
import { preparePaymentPageHtml } from "./paymentPageHtml";

const SAMPLE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <script type="application/ld+json">
    { "@type": "ProfessionalService", "name": "Digerati Experts" }
    </script>
    <!-- Structured Data for Local Business -->
    <script type="application/ld+json">
    { "name": "Digerati Experts" }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <!-- Google Consent Mode v2 - must run before GA4 loads -->
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>
`;

describe("preparePaymentPageHtml", () => {
  it("strips marketing inline scripts, font onload, and disables Rocket Loader", () => {
    const html = preparePaymentPageHtml(SAMPLE, "test-nonce");
    expect(html).not.toContain("dataLayer");
    expect(html).not.toContain("gtag");
    expect(html).not.toContain("application/ld+json");
    expect(html).not.toContain("onload=");
    expect(html).toContain('data-cfasync="false"');
    expect(html).toContain('nonce="test-nonce"');
    expect(html).toContain('src="/assets/index-abc.js"');
    expect(html).toContain("fonts.googleapis.com");
    expect(html).not.toMatch(/Digerati(?! Experts)/);
  });
});
