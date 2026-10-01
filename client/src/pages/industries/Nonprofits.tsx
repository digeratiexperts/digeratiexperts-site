import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { CheckCircle, Heart, Users, Shield, Zap, TrendingUp, Target, Phone, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

export default function Nonprofits() {
  useSEO({
    title: "IT & Cybersecurity for Nonprofits",
    description:
      "Affordable managed IT and security for Arizona nonprofits — protect donor data, grant systems, and board confidence.",
    canonical: "/industries/nonprofits",
  });

  const focusAreas = [
    { title: "Donor data", body: "Access control and encryption for donation systems and CRM.", icon: Heart },
    { title: "Grant evidence", body: "Documentation funders and auditors typically request.", icon: Shield },
    { title: "Right-sized IT", body: "Support that does not assume a hospital-sized IT department.", icon: Zap },
    { title: "Arizona partner", body: "A local operator you can call — not a ticket mill.", icon: Users },
  ];

  return (
    <PageTemplate
      title="IT Solutions for Nonprofits"
      subtitle="Cost-effective, compliant IT for mission-driven organizations in Arizona"
      icon={<Heart className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Nonprofits" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold" data-testid="button-hero-nonprofit">
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
            <IconWell icon={Target} size="md" surface="dark" />
            <div>
              <h3 className="mb-3 text-2xl font-bold text-white">Nonprofit IT Challenges</h3>
              <div className="space-y-2 text-white/75">
                {[
                  "Limited IT budgets—every dollar matters for mission",
                  "Volunteer staff with limited technical expertise",
                  "Donor data privacy requirements (PII protection)",
                  "Grant compliance requirements (security evidence)",
                  "Rapid growth strains IT infrastructure",
                ].map((item) => (
                  <div key={item} className="flex gap-2">
                    <span className="font-bold text-de-accent-ink" aria-hidden="true">
                      •
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white">Nonprofit-Specific IT Services</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Zap,
                title: "Nonprofit Pricing",
                desc: "20% discount for 501(c)(3)s",
                features: ["20% managed IT discount", "No setup or onboarding fees", "Microsoft nonprofit grants", "Scaled pricing for growth", "Flexible service tiers"],
              },
              {
                icon: Shield,
                title: "Donor Data Protection",
                desc: "Secure donation processing",
                features: ["PCI DSS compliance", "Encrypted donor database", "GDPR/state privacy", "Secure online donations", "Backup protection"],
              },
              {
                icon: Users,
                title: "Grant Compliance",
                desc: "Meet funder requirements",
                features: ["Security documentation", "Data retention procedures", "Vendor risk management", "Incident response planning", "Compliance evidence packets"],
              },
              {
                icon: TrendingUp,
                title: "Scalable Growth",
                desc: "IT grows with mission",
                features: ["Add users without overhaul", "Remote team support", "Cloud app integration", "Multi-office capability", "Nonprofit software support"],
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
          <h3 className="mb-8 text-center text-2xl font-bold text-white">Nonprofit Programs We Support</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Microsoft Nonprofit Grants",
              "Google Workspace for Nonprofits",
              "Adobe Creative Cloud Discounts",
              "Salesforce Nonprofit Edition",
              "Neon CRM Integration",
              "QuickBooks Nonprofit Pricing",
            ].map((prog) => (
              <div key={prog} className={`flex items-center gap-3 p-3 ${insetClass}`}>
                <CheckCircle className="h-5 w-5 shrink-0 text-de-accent-ink" aria-hidden="true" />
                <span className="font-medium text-white/80">{prog}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`grid gap-6 p-8 md:grid-cols-3 ${cardClass}`}>
          <div className="text-center">
            <p className="mb-2 text-lg font-semibold text-white">Mission-first pricing</p>
            <p className="text-sm text-white/70">20% managed IT discount for 501(c)(3) organizations, with vendor nonprofit programs where eligible.</p>
          </div>
          <div className="text-center md:border-l md:border-r md:border-de-hairline md:px-6">
            <p className="mb-2 text-lg font-semibold text-white">Grant-ready evidence</p>
            <p className="text-sm text-white/70">Documentation funders typically request — not a claimed 100% audit pass rate.</p>
          </div>
          <div className="text-center">
            <p className="mb-2 text-lg font-semibold text-white">Someone to call</p>
            <p className="text-sm text-white/70">Arizona team for donor-data and grant-system issues — <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>.</p>
          </div>
        </div>

        <div className={`p-8 text-center ${cardClass}`}>
          <h2 className="mb-4 text-3xl font-bold text-white">Focus on Your Mission</h2>
          <p className="mb-6 text-lg text-white/70">Let us handle technology. Start with a Cyber Risk Assessment and nonprofit pricing conversation.</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-schedule-nonprofit">
              <a href="/book">{CTA.primary}</a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10"
              data-testid="button-call-nonprofit"
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
