import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Lock, Download, Zap, Shield, ExternalLink, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";

const PORTAL_LOGIN = "https://portal.digeratiexperts.com/portal/login";
const PORTAL_INVOICES = "https://portal.digeratiexperts.com/portal/invoices";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";

export default function PayInvoice() {
  useSEO({
    title: "Pay Invoice | Digerati Experts",
    description:
      "Pay Digerati Experts invoices in the Client Portal. Credit card and ACH are processed there — not on this marketing page.",
    canonical: "/support/pay-invoice",
  });

  const methods = [
    {
      icon: CreditCard,
      title: "Credit/Debit Card",
      features: ["Visa, MasterCard, Amex", "Processed in the Client Portal", "Secure payment gateway"],
    },
    {
      icon: Lock,
      title: "Bank Transfer (ACH)",
      features: ["Direct account transfer", "1-3 business days", "No credit card fees"],
    },
  ];

  const features = [
    { icon: Download, title: "Download Invoices", desc: "View and download all invoices and receipts in the portal" },
    { icon: Zap, title: "Auto-Pay Setup", desc: "Set up automatic monthly payments where available" },
    { icon: Shield, title: "Secure Payments", desc: "Encrypted checkout through the Client Portal" },
    { icon: CreditCard, title: "Payment History", desc: "Complete transaction records in your account" },
  ];

  return (
    <PageTemplate
      title="Pay Your Invoice"
      subtitle="Pay invoices securely through the Digerati Experts Client Portal."
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Pay Invoice" }]}
    >
      <div className="space-y-16">
        <div className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-8 py-10 text-center md:px-12 md:py-12">
          <h2 className="mb-3 font-heading text-2xl font-semibold text-white md:text-3xl">
            Pay invoices in the Client Portal
          </h2>
          <p className="mx-auto mb-6 max-w-2xl leading-relaxed text-white">
            This marketing page does not process payments. Sign in to the Client Portal to view open invoices and pay securely. If you&apos;re already logged in, go straight to Invoices.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95" data-testid="button-portal-login-pay">
              <a href={PORTAL_LOGIN}>
                Sign in to Client Portal
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/70 bg-transparent px-8 font-semibold text-white hover:bg-white/10 hover:text-white"
              data-testid="button-portal-invoices"
            >
              <a href={PORTAL_INVOICES}>
                Go to Invoices
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-white">
            Portal login: portal.digeratiexperts.com/portal/login
          </p>
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold text-white">Multiple Payment Options</h2>
          <p className="text-xl leading-relaxed text-white/70">
            Once signed in, you can use credit cards and bank transfers for your convenience. All payments are processed securely through the Client Portal — not on this page.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <div key={method.title} className={`de-interactive-card h-full p-6 ${cardClass}`}>
                <IconWell icon={Icon} size="md" surface="dark" className="mb-3" />
                <h3 className="mb-4 text-xl font-semibold text-white">{method.title}</h3>
                <ul className="space-y-3">
                  {method.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" aria-hidden="true" />
                      <span className="text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className={`p-8 md:p-12 ${cardClass}`}>
          <h2 className="mb-8 text-center text-2xl font-bold text-white">Payment Portal Features</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex gap-4 rounded-xl border border-de-hairline bg-de-bg p-4">
                  <IconWell icon={Icon} size="md" surface="dark" />
                  <div>
                    <h3 className="mb-1 font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-white/65">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {[
            { badge: "Encrypted checkout", label: "TLS in transit" },
            { badge: "Security questionnaires", label: "Available on request" },
            { badge: "Framework alignment", label: "HIPAA · SOC 2 · insurance" },
          ].map((cert) => (
            <div key={cert.badge} className="rounded-xl border border-de-hairline bg-de-raised px-4 py-3">
              <p className="font-semibold text-white">{cert.badge}</p>
              <p className="text-xs text-white/55">{cert.label}</p>
            </div>
          ))}
        </div>

        <div className={`p-8 text-center ${cardClass}`}>
          <h2 className="mb-4 text-2xl font-bold text-white">Having Trouble?</h2>
          <p className="mb-6 text-white/70">
            Our MSP billing support team is ready to help with any payment questions or issues.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-support-payment">
              <a href="/support/submit-ticket">Contact Support</a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10"
              data-testid="button-call-payment"
            >
              <a href={PRIMARY_PHONE.telHref}>Call Us</a>
            </Button>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
