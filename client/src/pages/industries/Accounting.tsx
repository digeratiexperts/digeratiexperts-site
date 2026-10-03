import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, Lock, FileText, AlertCircle, DollarSign, Activity, Phone, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

export default function Accounting() {
  useSEO({
    title: "IT & Cybersecurity for Accounting Firms",
    description:
      "Managed IT and security for Arizona accounting and finance firms — stop BEC, protect tax season systems, and meet cyber-insurance expectations.",
    canonical: "/industries/accounting-finance",
  });

  const capabilities = [
    { label: "Tax-season systems", value: "Identity, email, and backup owned through busy season", icon: Activity },
    { label: "Client data", value: "Access control and encryption for workpapers and portals", icon: Lock },
    { label: "Insurance reviews", value: "Evidence and control mapping carriers typically ask for", icon: FileText },
    { label: "BEC / wire fraud", value: "MFA, email protection, and verification workflows", icon: Shield },
  ];

  return (
    <PageTemplate
      title="IT Solutions for Accounting & Finance"
      subtitle="PCI DSS-aligned security and financial data protection for Arizona CPAs and accounting firms"
      icon={<FileText className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Accounting & Finance" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold" data-testid="button-hero-accounting">
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
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`de-interactive-card p-6 ${cardClass}`}>
                <Icon className="mb-3 h-6 w-6 text-de-accent-ink" aria-hidden="true" />
                <p className="font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{item.value}</p>
              </div>
            );
          })}
        </div>

        <div className={`p-8 ${cardClass}`}>
          <div className="flex gap-4">
            <IconWell icon={AlertCircle} size="md" surface="dark" />
            <div>
              <h3 className="mb-3 text-2xl font-bold text-white">Financial Services Risk Profile</h3>
              <div className="space-y-2 text-white/75">
                {[
                  "PCI DSS compliance required for credit card processing",
                  "IRS data security requirements (NIST compliance)",
                  "Client confidentiality and privilege concerns",
                  "Wire fraud and business email compromise targeting financial transfers",
                ].map((item) => (
                  <div key={item} className="flex gap-2">
                    <span className="font-bold text-de-accent-ink" aria-hidden="true">
                      ●
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold text-white">Why Accounting Firms Choose Digerati Experts</h2>
          <p className="mx-auto max-w-3xl text-xl text-white/70">
            Accounting firms need IT partners who understand compliance, deadline pressure, and the reality of financial data handling.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: Lock,
              title: "PCI DSS Compliance",
              desc: "Full PCI DSS compliance framework",
              features: ["Secure payment gateways", "Tokenization & encryption", "Quarterly security assessments", "Audit-grade documentation"],
            },
            {
              icon: FileText,
              title: "Tax Data Protection",
              desc: "IRS and NIST compliance",
              features: ["NIST framework alignment", "Encryption for tax returns", "Secure document retention", "Access controls & audit logging"],
            },
            {
              icon: DollarSign,
              title: "Wire Fraud Prevention",
              desc: "Multi-layer transfer security",
              features: ["Email authentication (DMARC)", "Business email compromise detection", "MFA enforcement", "Wire instruction verification"],
            },
            {
              icon: Shield,
              title: "Backup & Disaster Recovery",
              desc: "Zero downtime during tax season",
              features: ["Real-time cloud backup", "Monthly restore testing", "DR runbooks", "Ransomware recovery"],
            },
          ].map((service) => {
            const Icon = service.icon;
            return (
              <div key={service.title} className={`de-interactive-card h-full p-6 ${cardClass}`}>
                <Icon className="mb-2 h-10 w-10 text-de-accent-ink" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-white">{service.title}</h3>
                <p className="mt-2 text-sm text-white/55">{service.desc}</p>
                <ul className="mt-4 space-y-2">
                  {service.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/80">
                      <CheckCircle className="h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className={`p-8 md:p-12 ${cardClass}`}>
          <h3 className="mb-3 text-center text-2xl font-bold text-white">Security & Compliance Support</h3>
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-white/55">
            Framework names describe customer requirements we help organizations address — not certifications DE holds.
          </p>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { title: "HIPAA-aligned support", label: "Security and compliance support for practices handling PHI" },
              { title: "SOC 2 readiness", label: "Control mapping and evidence — not a Digerati Experts certification" },
              { title: "Cyber insurance readiness", label: "Documentation carriers typically request in underwriting" },
              { title: "Security reporting", label: "Repeatable evidence for audits and client questionnaires" },
            ].map((item) => (
              <div key={item.title} className={`p-4 text-left ${insetClass}`}>
                <p className="mb-1 text-sm font-semibold text-white">{item.title}</p>
                <p className="text-sm text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`grid gap-6 p-8 md:grid-cols-3 ${cardClass}`}>
          <div className="text-center">
            <p className="mb-2 text-lg font-semibold text-white">Audit readiness</p>
            <p className="text-sm text-white/70">Control mapping and evidence for reviews — not a claim that findings disappear.</p>
          </div>
          <div className="text-center md:border-l md:border-r md:border-de-hairline md:px-6">
            <p className="mb-2 text-lg font-semibold text-white">Insurance questions</p>
            <p className="text-sm text-white/70">Documentation carriers typically request. Premium outcomes vary by underwriter.</p>
          </div>
          <div className="text-center">
            <p className="mb-2 text-lg font-semibold text-white">Repeatable reporting</p>
            <p className="text-sm text-white/70">Security and compliance reporting as an operating practice, not a one-time binder.</p>
          </div>
        </div>

        <div className={`p-8 text-center ${cardClass}`}>
          <h2 className="mb-4 text-3xl font-bold text-white">Ready to Protect Your Firm?</h2>
          <p className="mb-6 text-lg text-white/70">Start with a Cyber Risk Assessment from Arizona MSP experts.</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-schedule-accounting">
              <a href="/book">{CTA.primary}</a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10"
              data-testid="button-call-accounting"
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
