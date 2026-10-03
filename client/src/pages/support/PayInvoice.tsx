import { useEffect, useState } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { CreditCard, Lock, Download, Zap, Shield } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { COMPANY } from "@/data/companyContact";
import { loadCardCheckoutAvailable } from "@/lib/invoicePaymentAvailability";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FactStrip,
  FeatureGrid,
  HeroActions,
} from "@/components/site/chapters";

const PORTAL_LOGIN = "https://portal.digeratiexperts.com/portal/login";
const PORTAL_INVOICES = "https://portal.digeratiexperts.com/portal/invoices";

export default function PayInvoice() {
  const [cardCheckout, setCardCheckout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCardCheckoutAvailable().then((available) => {
      if (!cancelled) setCardCheckout(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useSEO({
    title: "Pay Invoice | Digerati Experts",
    description: cardCheckout
      ? "View Digerati Experts invoices in the Client Portal. Card checkout is available after you sign in. This page does not process payments."
      : "View Digerati Experts invoices in the Client Portal. Card checkout is not connected on the site yet. This page does not process payments.",
    canonical: "/support/pay-invoice",
  });

  const methods = [
    {
      icon: CreditCard,
      title: "Credit/Debit Card",
      features: cardCheckout
        ? ["Visa, MasterCard, Amex", "Processed in the Client Portal", "Secure payment gateway"]
        : [
            "Not connected in the Client Portal yet",
            "This page does not charge a card",
            `Email ${COMPANY.billingEmail} with the invoice number`,
          ],
    },
    {
      icon: Lock,
      title: "Bank transfer",
      features: [
        "ACH, wire, and check are arranged with billing",
        "Not collected on this page",
        "Ask support for the instructions on your invoice",
      ],
    },
  ];

  const features = [
    { icon: Download, title: "Download Invoices", desc: "View and download all invoices and receipts in the portal" },
    { icon: Zap, title: "Auto-Pay Setup", desc: cardCheckout ? "Set up automatic monthly payments where available" : "Automatic card payments are not available until checkout is connected" },
    { icon: Shield, title: "Secure Payments", desc: cardCheckout ? "Encrypted checkout through the Client Portal" : "Invoices stay in the Client Portal. Card checkout is not connected yet" },
    { icon: CreditCard, title: "Payment History", desc: "Complete transaction records in your account" },
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Support · Billing"
      title="Pay Your Invoice"
      subtitle="Pay invoices securely through the Digerati Experts Client Portal."
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Pay Invoice" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Sign in to Client Portal", href: PORTAL_LOGIN, testId: "button-portal-login-pay" }}
            secondary={{ label: "Go to Invoices", href: PORTAL_INVOICES, testId: "button-portal-invoices" }}
          />
        </div>
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid gap-8 border-b border-[var(--de-paper-hairline)] pb-12 lg:grid-cols-12 lg:gap-14">
            <h2 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228] lg:col-span-5">
              Pay invoices in the Client Portal
            </h2>
            <div className="lg:col-span-7">
              <p className="max-w-[60ch] text-lg leading-relaxed text-[#3A3448]">
                This page does not process payments. Sign in to the Client Portal to view open invoices.
                {cardCheckout
                  ? " Card checkout is available after you sign in."
                  : " Card checkout is not connected yet, so billing takes those payments another way."}
              </p>
              <p className="mt-4 text-sm text-black/60">Portal login: portal.digeratiexperts.com/portal/login</p>
            </div>
          </div>

          <div className="pt-12">
            <ChapterHeader
              tone="paper"
              eyebrow="Payment options"
              title="Multiple Payment Options"
              lede={
                cardCheckout
                  ? "Card checkout runs in the Client Portal after you sign in. Bank transfers are arranged with billing, not on this page."
                  : "The portal shows your invoices. Card checkout is not connected on the site yet, and bank transfers are arranged with billing rather than collected here."
              }
            />
            <ul className="grid gap-4 md:grid-cols-2 md:gap-5">
              {methods.map((method) => (
                <li key={method.title} className="rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6">
                  <method.icon className="mb-4 h-5 w-5 text-de-magenta-paper-ink" aria-hidden="true" />
                  <h3 className="mb-4 font-heading text-lg font-semibold text-[#1A1228]">{method.title}</h3>
                  <CheckList tone="paper" columns={1} items={method.features} />
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader tone="well" eyebrow="In the portal" title="Payment Portal Features" />
          <FeatureGrid tone="well" columns={4} items={features.map((f) => ({ icon: f.icon, title: f.title, text: f.desc }))} />
        </Container>
      </Chapter>

      <FactStrip
        label="Payment security"
        facts={[
          { title: "Encrypted checkout", text: "TLS in transit" },
          { title: "Security questionnaires", text: "Available on request" },
          { title: "Framework alignment", text: "HIPAA · SOC 2 · insurance" },
        ]}
      />

      <ClosingCta
        tone="surface"
        eyebrow="Billing help"
        title="Having Trouble?"
        lede="Our MSP billing support team is ready to help with any payment questions or issues."
        showPhone={false}
        primary={{ label: "Contact Support", href: "/support/submit-ticket", testId: "button-support-payment" }}
        secondary={{ label: "Call Us", href: PRIMARY_PHONE.telHref, testId: "button-call-payment" }}
      />
    </PageTemplate>
  );
}
