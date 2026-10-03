import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FactStrip,
  HeroActions,
} from "@/components/site/chapters";
import { IconWell } from "@/components/visual/IconWell";
import {
  Shield,
  Briefcase,
  Users,
  Trophy,
  Clock,
  MapPin,
  Activity,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { photography } from "@/lib/visualAssets";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const team = [
  {
    name: "Leadership Team",
    description:
      "Industry veterans with decades of combined experience in IT and cybersecurity",
    certifications: [
      "CISSP",
      "CISM",
      "Microsoft Certified",
      "CompTIA Security+",
    ],
    icon: Trophy,
  },
  {
    name: "Security Engineers",
    description:
      "Specialized cybersecurity experts protecting your business 24/7",
    certifications: ["CEH", "GIAC", "OSCP", "Security+"],
    icon: Shield,
  },
  {
    name: "System Engineers",
    description: "Infrastructure experts ensuring your systems run smoothly",
    certifications: [
      "MCSE",
      "VMware VCP",
      "AWS Certified",
      "Azure Administrator",
    ],
    icon: Briefcase,
  },
  {
    name: "Support Team",
    description:
      "Friendly, responsive technicians ready to help when you need it",
    certifications: ["A+", "Network+", "ITIL", "HDI Support"],
    icon: Users,
  },
];

const certCategories = [
  {
    title: "Security Certifications",
    items: [
      "CISSP - Certified Information Systems Security Professional",
      "CISM - Certified Information Security Manager",
      "CEH - Certified Ethical Hacker",
      "OSCP - Offensive Security Certified Professional",
    ],
  },
  {
    title: "Technical Certifications",
    items: [
      "Microsoft Certified Solutions Expert",
      "VMware Certified Professional",
      "AWS Certified Solutions Architect",
      "CompTIA A+, Network+, Security+",
    ],
  },
  {
    title: "Partner Status",
    items: [
      "Microsoft Partner Network",
      "Apple Consultants Network",
      "Better Business Bureau A+ Rating",
    ],
  },
];

export default function Team() {
  useSEO({
    title: "Our Team - Certified IT & Security Experts",
    description:
      "Meet the Digerati Experts team. Certified cybersecurity professionals, system engineers, and IT support specialists serving Arizona businesses.",
    canonical: "/about/team",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="About · Team"
      title="Meet The Experts"
      subtitle="Our certified team of IT and security professionals serving Chandler and the Phoenix metro area"
      breadcrumbs={[{ label: "About" }, { label: "Team" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{
              label: `Call ${PRIMARY_PHONE.display}`,
              href: PRIMARY_PHONE.telHref,
            }}
          />
        </div>
      }
      heroAside={
        <div
          className="flex flex-col items-start gap-6 rounded-xl border border-[var(--de-hairline)] bg-de-raised p-6 sm:flex-row sm:items-center md:p-7"
          data-testid="founder-spotlight"
        >
          {photography.founderHeadshot.available && (
            <picture>
              <source
                srcSet={photography.founderHeadshot.src}
                type="image/webp"
              />
              <img
                src={photography.founderHeadshot.srcPng}
                alt={photography.founderHeadshot.alt}
                width={160}
                height={160}
                loading="lazy"
                decoding="async"
                className="h-36 w-36 shrink-0 rounded-xl border border-[var(--de-hairline)] object-cover sm:h-40 sm:w-40"
              />
            </picture>
          )}
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-de-magenta-ink">
              Founder
            </p>
            <h2 className="mb-2 font-heading text-2xl font-semibold text-white">
              Joseph Petro
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              Principal-led cybersecurity and managed IT for Arizona businesses
              — accountable recommendations from the people who stand behind the
              work.
            </p>
          </div>
        </div>
      }
    >
      <FactStrip
        label="Team coverage"
        facts={[
          {
            icon: Activity,
            title: "24/7 monitoring",
            text: "Security operations coverage as documented in our SLA.",
          },
          {
            icon: Clock,
            title: "15-minute first response",
            text: "Published first-response target during covered hours.",
          },
          {
            icon: MapPin,
            title: "Chandler, Arizona",
            text: "Local accountability for Phoenix-metro businesses.",
          },
        ]}
      />

      <Chapter tone="paper" seam={false}>
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Who does the work"
            title="Four teams, one accountable owner"
            lede="Our team brings together decades of experience in IT management, cybersecurity, and business technology. We're passionate about protecting Arizona businesses and helping them succeed with technology."
          />
          <ul className="border-t border-[var(--de-paper-hairline)]">
            {team.map((group) => (
              <li
                key={group.name}
                className="grid gap-5 border-b border-[var(--de-paper-hairline)] py-8 lg:grid-cols-12 lg:gap-14"
              >
                <div className="flex items-center gap-4 lg:col-span-4">
                  <IconWell icon={group.icon} size="md" surface="light" />
                  <h3 className="font-heading text-xl font-semibold text-[#1A1228]">
                    {group.name}
                  </h3>
                </div>
                <div className="lg:col-span-8">
                  <p className="max-w-[60ch] text-base leading-relaxed text-[#3A3448]">
                    {group.description}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {group.certifications.map((cert) => (
                      <li
                        key={cert}
                        className="rounded-md border border-[var(--de-paper-hairline)] bg-white px-3 py-1.5 text-sm text-[#1A1228]"
                      >
                        {cert}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Credentials"
            title="Our Certifications & Partnerships"
          />
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {certCategories.map((category) => (
              <div
                key={category.title}
                className="border-t border-[var(--de-hairline)] pt-6"
              >
                <h3 className="mb-5 font-heading text-lg font-semibold text-white">
                  {category.title}
                </h3>
                <CheckList tone="well" columns={1} items={category.items} />
              </div>
            ))}
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Ready to work with our team?"
        lede="Schedule a Cyber Risk Assessment and meet the people who will protect your Arizona business."
        primary={{
          label: CTA.primary,
          href: "/book",
          testId: "button-conversion-assessment",
        }}
      />
    </PageTemplate>
  );
}
