import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  FactStrip,
  HeroActions,
  HeroFacts,
  IndexedList,
  cardDark,
} from "@/components/site/chapters";
import { ServiceBlocks } from "@/components/site/IndustriesServiceBlocks";
import { Heart, Users, Shield, Zap, TrendingUp } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function Nonprofits() {
  useSEO({
    title: "IT & Cybersecurity for Nonprofits",
    description:
      "Affordable managed IT and security for Arizona nonprofits — protect donor data, grant systems, and board confidence.",
    canonical: "/industries/nonprofits",
  });

  const focusAreas = [
    { title: "Donor data", text: "Access control and encryption for donation systems and CRM.", icon: Heart },
    { title: "Grant evidence", text: "Documentation funders and auditors typically request.", icon: Shield },
    { title: "Right-sized IT", text: "Support that does not assume a hospital-sized IT department.", icon: Zap },
    { title: "Arizona partner", text: "A local operator you can call — not a ticket mill.", icon: Users },
  ];

  const challenges = [
    "Limited IT budgets—every dollar matters for mission",
    "Volunteer staff with limited technical expertise",
    "Donor data privacy requirements (PII protection)",
    "Grant compliance requirements (security evidence)",
    "Rapid growth strains IT infrastructure",
  ];

  const services = [
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
  ];

  const programs = [
    "Microsoft Nonprofit Grants",
    "Google Workspace for Nonprofits",
    "Adobe Creative Cloud Discounts",
    "Salesforce Nonprofit Edition",
    "Neon CRM Integration",
    "QuickBooks Nonprofit Pricing",
  ];

  const promises = [
    {
      title: "Mission-first pricing",
      text: "20% managed IT discount for 501(c)(3) organizations, with vendor nonprofit programs where eligible.",
    },
    { title: "Grant-ready evidence", text: "Documentation funders typically request — not a claimed 100% audit pass rate." },
    {
      title: "Someone to call",
      text: (
        <>
          Arizona team for donor-data and grant-system issues — <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>.
        </>
      ),
    },
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Nonprofits · Arizona organizations"
      title="IT Solutions for Nonprofits"
      subtitle="Cost-effective, compliant IT for mission-driven organizations in Arizona"
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Nonprofits" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-hero-nonprofit" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Nonprofit pricing"
          rows={[
            { label: "Discount", value: "20% managed IT for 501(c)(3)s" },
            { label: "Onboarding", value: "No setup or onboarding fees" },
            { label: "Vendor programs", value: "Microsoft nonprofit grants, where eligible" },
            { label: "Tiers", value: "Flexible, scaled for growth" },
          ]}
          footnote="Final scope and pricing are confirmed after a Cyber Risk Assessment conversation."
        />
      }
    >
      <div data-testid="section-focus-areas">
        <FactStrip facts={focusAreas} label="Where we focus for nonprofits" />
      </div>

      <Chapter tone="well" seam={false} data-testid="section-challenges">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="The constraints"
            title="Nonprofit IT Challenges"
            lede="Real budgets, volunteer teams, and funders who want evidence."
          />
          <IndexedList tone="well" items={challenges.map((t) => ({ title: t }))} />
        </Container>
      </Chapter>

      <Chapter tone="paper" data-testid="section-services">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="What we run"
            title="Nonprofit-Specific IT Services"
            lede="Pricing, donor protection, grant evidence, and room to grow."
          />
          <ServiceBlocks tone="paper" items={services} />
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="section-programs">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <ChapterHeader
                tone="surface"
                layout="stack"
                eyebrow="Vendor programs"
                title="Nonprofit Programs We Support"
                lede="Discounts and grants worth using, set up alongside your managed IT."
                className="mb-0"
              />
            </div>
            <div className={`${cardDark} p-6 md:p-8 lg:col-span-8 lg:self-start`}>
              <CheckList tone="surface" items={programs} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter plate="ring" tone="well" data-testid="section-promises">
        <Container>
          <ChapterHeader tone="well" eyebrow="What to expect" title="Practical, not promised" lede="Three commitments, stated without guarantees we cannot back." />
          <IndexedList tone="well" items={promises} />
        </Container>
      </Chapter>

      <div data-testid="section-final-cta">
        <ClosingCta
          tone="paper"
          title="Focus on Your Mission"
          lede="Let us handle technology. Start with a Cyber Risk Assessment and nonprofit pricing conversation."
          primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-nonprofit" }}
          phoneTestId="button-call-nonprofit"
        />
      </div>
    </PageTemplate>
  );
}
