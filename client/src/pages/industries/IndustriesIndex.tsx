import { Link } from "wouter";
import { ArrowRight, Building2, Calculator, Heart, Home, PawPrint, Scale, Stethoscope } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { Chapter, Container, ChapterHeader, ClosingCta, HeroActions } from "@/components/site/chapters";
import { IconWell } from "@/components/visual/IconWell";

const industries = [
  {
    name: "Healthcare",
    href: "/industries/healthcare",
    description: "HIPAA-aligned operations, patient data protection, and insurance-ready controls.",
    icon: Stethoscope,
  },
  {
    name: "Law Firms",
    href: "/industries/law-firms",
    description: "Client privilege, ABA expectations, and secure collaboration for matters.",
    icon: Scale,
  },
  {
    name: "Accounting & Finance",
    href: "/industries/accounting-finance",
    description: "Tax-season resilience, IRS/FTC readiness, and locked-down financial data.",
    icon: Calculator,
  },
  {
    name: "Real Estate",
    href: "/industries/real-estate",
    description: "Wire-fraud defenses and transaction security for brokerages and teams.",
    icon: Home,
  },
  {
    name: "Nonprofits",
    href: "/industries/nonprofits",
    description: "Right-sized IT and security for mission-driven organizations.",
    icon: Heart,
  },
  {
    name: "Professional Services",
    href: "/industries/professional-services",
    description: "Client data protection and reliable operations for service firms.",
    icon: Building2,
  },
  {
    name: "Animal Hospitals",
    href: "/industries/animal-hospitals",
    description: "Practice systems, client records, and veterinary workflow continuity.",
    icon: PawPrint,
  },
];

export default function IndustriesIndex() {
  useSEO({
    title: "Industries We Serve",
    description:
      "Industry-specific managed IT and cybersecurity for Arizona healthcare, law, accounting, real estate, nonprofits, and professional services.",
    canonical: "/industries",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Industries · Arizona"
      title="Industries We Serve"
      subtitle="Security-first IT shaped around how your practice, firm, or organization actually works."
      breadcrumbs={[{ label: "Industries" }]}
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      <Chapter plate="industries" tone="paper" seam={false} data-testid="section-industries">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Choose your field"
            title="Seven industries, one operating model"
            lede="Each page covers the risks, controls, and evidence that matter for that kind of organization."
          />
          <ul className="grid gap-x-14 border-t border-[var(--de-paper-hairline)] md:grid-cols-2">
            {industries.map((industry) => {
              const Icon = industry.icon;
              return (
                <li key={industry.href} className="border-b border-[var(--de-paper-hairline)]">
                  <Link
                    href={industry.href}
                    className="group -mx-3 flex items-start gap-5 rounded-lg px-3 py-6 transition-colors hover:bg-[#D3126A]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] md:py-7"
                  >
                    <IconWell icon={Icon} surface="light" className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <h2 className="font-heading text-xl font-semibold leading-snug text-[#1A1228]">{industry.name}</h2>
                      <span className="mt-1.5 block text-base leading-relaxed text-[#3A3448]">{industry.description}</span>
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-de-magenta-paper-ink">
                        View industry
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </Chapter>

      <ClosingCta
        title="Not sure where you fit?"
        lede="Start with a cyber risk assessment. We match the operating model to your environment before you buy."
        primary={{ label: CTA.primary, href: "/book" }}
      />
    </PageTemplate>
  );
}
