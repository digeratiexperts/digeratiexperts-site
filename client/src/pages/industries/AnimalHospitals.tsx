import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  FactStrip,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  Prose,
  cardDark,
} from "@/components/site/chapters";
import { Shield, Lock, Activity, Database, Users } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function AnimalHospitals() {
  useSEO({
    title: "IT & Cybersecurity for Veterinary Practices",
    description:
      "Managed IT and cybersecurity for Arizona animal hospitals — protect PIMS, imaging, and client records without building an internal IT team.",
    canonical: "/industries/animal-hospitals",
  });

  const focusAreas = [
    { title: "Practice systems", text: "PIMS, imaging, and billing", icon: Activity },
    { title: "Client records", text: "Access control and backup", icon: Shield },
    { title: "Payments", text: "PCI-aware processing", icon: Lock },
    { title: "Continuity", text: "Restore-tested recovery paths", icon: Database },
  ];

  const challenges = [
    {
      icon: Database,
      title: "Patient Records Security",
      description: "Protect sensitive pet medical records and client payment information with enterprise-grade encryption.",
    },
    {
      icon: Lock,
      title: "Payment Card Compliance",
      description: "Maintain PCI DSS compliance for credit card transactions and client billing systems.",
    },
    {
      icon: Users,
      title: "Multi-Location Management",
      description: "Seamlessly manage IT across multiple clinic locations with centralized security and monitoring.",
    },
  ];

  const securityFeatures = [
    "Practice Management System Security",
    "Encrypted Client Communications",
    "Secure Payment Processing",
    "24/7 Network Monitoring",
    "Backup & Disaster Recovery",
    "Email Protection & Anti-Phishing",
    "Endpoint Security (EDR)",
    "Security Awareness Training",
    "Remote Access Security",
    "Compliance Documentation",
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Animal hospitals · Arizona veterinary practices"
      title="IT Solutions for Veterinary Practices"
      subtitle="Secure, reliable IT solutions designed specifically for animal hospitals and veterinary clinics across Arizona."
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Animal Hospitals" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-hero-vet" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Practice focus"
          rows={[
            { label: "Systems", value: "PIMS, imaging, and billing" },
            { label: "Records", value: "Client and patient data, backed up" },
            { label: "Payments", value: "PCI-aware processing" },
            { label: "Sites", value: "Single clinics to multi-location" },
          ]}
        />
      }
    >
      <div data-testid="section-focus-areas">
        <FactStrip facts={focusAreas} label="What we protect in a veterinary practice" />
      </div>

      <Chapter tone="well" seam={false} data-testid="section-targets">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <ChapterHeader
                tone="well"
                layout="stack"
                eyebrow="The exposure"
                title="Veterinary Practices Are Prime Targets"
                className="mb-0"
              />
            </div>
            <div className="lg:col-span-7">
              <Prose tone="well">
                <p className="text-lg leading-relaxed text-white/80">
                  Animal hospitals store valuable client payment data, pet insurance information, and personal contact details.
                  Cybercriminals increasingly target veterinary practices knowing they often lack enterprise-grade security.
                  A single ransomware attack can halt operations, disrupt patient care, and damage your reputation.
                </p>
              </Prose>
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter plate="white" tone="paper" data-testid="section-challenges">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="What we solve"
            title="Challenges We Solve for Veterinary Practices"
            lede="Records, cards, and clinics: the three places veterinary IT most often falls short."
          />
          <FeatureGrid
            tone="paper"
            items={challenges.map((c) => ({ icon: c.icon, title: c.title, text: c.description }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="section-security">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <ChapterHeader
                tone="surface"
                layout="stack"
                eyebrow="Controls"
                title="Complete Security for Your Practice"
                lede="The building blocks behind the program, from practice software to the front-desk laptop."
                className="mb-0"
              />
            </div>
            <div className={`${cardDark} p-6 md:p-8 lg:col-span-8 lg:self-start`}>
              <CheckList tone="surface" items={securityFeatures} />
            </div>
          </div>
        </Container>
      </Chapter>

      <div data-testid="section-final-cta">
        <ClosingCta
          tone="paper"
          title="Built for Arizona animal hospitals"
          lede="From small clinics to multi-location animal hospitals, we understand the unique IT needs of veterinary practices. Our team provides responsive support so you can focus on what matters most – caring for your patients."
          primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-call" }}
        />
      </div>
    </PageTemplate>
  );
}
