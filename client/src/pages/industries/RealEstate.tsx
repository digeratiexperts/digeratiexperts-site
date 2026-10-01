import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Shield, Lock, DollarSign, TrendingDown, Home, Phone, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

export default function RealEstate() {
  useSEO({
    title: "IT & Cybersecurity for Real Estate",
    description:
      "Protect Arizona brokerages from wire fraud and BEC with managed email security, MFA, and accountable IT support.",
    canonical: "/industries/real-estate",
  });

  const focusAreas = [
    { title: "Wire instruction fraud", body: "Verify-before-send workflows and mailbox protection for closings.", icon: Shield },
    { title: "Business email compromise", body: "MFA, email filtering, and staff awareness for brokerages.", icon: AlertCircle },
    { title: "Transaction data", body: "Access control for contracts, IDs, and shared deal rooms.", icon: Lock },
    { title: "Local accountability", body: "Arizona team you can call when a wire looks wrong.", icon: CheckCircle },
  ];

  return (
    <PageTemplate
      title="IT Solutions for Real Estate Professionals"
      subtitle="Prevent wire fraud, protect transaction data, stay compliant—secure IT for Arizona real estate"
      icon={<Home className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Real Estate" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold" data-testid="button-hero-real-estate">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10"
          >
            <a href={PRIMARY_PHONE.telHref}>Call {PRIMARY_PHONE.display}</a>
          </Button>
        </div>
      }
    >
      <div className="space-y-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {focusAreas.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={`de-interactive-card p-6 ${cardClass}`}>
                <Icon className="mb-3 h-6 w-6 text-de-accent-ink" aria-hidden="true" />
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{item.body}</p>
              </div>
            );
          })}
        </div>

        <div className={`p-8 ${cardClass}`}>
          <div className="flex gap-4">
            <IconWell icon={AlertCircle} size="md" surface="dark" />
            <div>
              <h3 className="mb-3 text-2xl font-bold text-white">Real Estate Wire Fraud: Active Threat</h3>
              <p className="mb-4 text-white/75">
                Criminals impersonate title companies, attorneys, and lenders with sophisticated phishing attacks targeting high-value transactions.
              </p>
              <div className="space-y-2 text-white/75">
                {[
                  "Fake wire instructions sent via email spoofing",
                  "Lost client funds (often non-recoverable)",
                  "TRID/RESPA violations from inadequate data security",
                  "Reputation damage and regulatory action",
                ].map((item) => (
                  <div key={item} className="flex gap-2">
                    <span className="font-bold text-de-accent-ink" aria-hidden="true">
                      ●
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white">Transaction Security Services</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                icon: DollarSign,
                title: "Wire Fraud Prevention",
                desc: "Multi-layer protection",
                features: ["Email authentication (DMARC/SPF)", "Business email compromise detection", "MFA for all systems", "Out-of-band verification", "Staff training on tactics"],
              },
              {
                icon: Lock,
                title: "Document Security",
                desc: "Transaction protection",
                features: ["End-to-end encrypted sharing", "Closing document protection", "Access controls", "Audit trails for access", "TRID compliance tracking"],
              },
              {
                icon: Shield,
                title: "TRID & RESPA Compliance",
                desc: "Federal requirements",
                features: ["Document retention tracking", "Secure eSignature with audit", "APR calculation docs", "Compliance certifications", "Closing disclosure logging"],
              },
              {
                icon: TrendingDown,
                title: "Ransomware Protection",
                desc: "Closing continuity",
                features: ["Real-time backup", "Immutable backups", "Fast recovery", "Contract-defined RTO/RPO", "Incident response"],
              },
            ].map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.title} className={`de-interactive-card p-6 ${cardClass}`}>
                  <Icon className="mb-2 h-10 w-10 text-de-accent-ink" aria-hidden="true" />
                  <h3 className="text-xl font-semibold text-white">{service.title}</h3>
                  <p className="mt-1 text-sm text-white/55">{service.desc}</p>
                  <ul className="mt-4 space-y-2">
                    {service.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-white/80">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`p-8 ${cardClass}`}>
          <h3 className="mb-6 text-2xl font-bold text-white">Wire Fraud Prevention Checklist</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Do you verify wire instructions via phone?",
              "Are your email systems protected against spoofing?",
              "Is MFA enabled on all systems?",
              "Do agents know fraud warning signs?",
              "Can you recover from ransomware?",
              "Do you have documented security procedures?",
            ].map((q) => (
              <div key={q} className={`flex gap-3 p-3 ${insetClass}`}>
                <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-de-accent-ink" aria-hidden="true" />
                <span className="text-sm text-white/80">{q}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`grid gap-6 p-8 md:grid-cols-3 ${cardClass}`}>
          <div className="text-center">
            <p className="mb-2 text-lg font-semibold text-white">Verify before you wire</p>
            <p className="text-sm text-white/70">Out-of-band confirmation for instruction changes — not a claimed $0-loss guarantee.</p>
          </div>
          <div className="text-center md:border-l md:border-r md:border-de-hairline md:px-6">
            <p className="mb-2 text-lg font-semibold text-white">Mailbox defenses</p>
            <p className="text-sm text-white/70">MFA and email protection sized to how brokerages actually work.</p>
          </div>
          <div className="text-center">
            <p className="mb-2 text-lg font-semibold text-white">Someone to call</p>
            <p className="text-sm text-white/70">Arizona team when a closing looks off — <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>.</p>
          </div>
        </div>

        <div className={`p-8 text-center ${cardClass}`}>
          <h2 className="mb-4 text-3xl font-bold text-white">Protect Your Transactions Today</h2>
          <p className="mb-6 text-lg text-white/70">Start with a Cyber Risk Assessment for your brokerage.</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-schedule-real-estate">
              <a href="/book">{CTA.primary}</a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10"
              data-testid="button-call-real-estate"
            >
              <a href={PRIMARY_PHONE.telHref}>
                <Phone className="mr-1 h-5 w-5" />
                Call {PRIMARY_PHONE.display}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
