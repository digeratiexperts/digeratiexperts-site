import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  FactStrip,
  HeroActions,
} from "@/components/site/chapters";
import { IconWell } from "@/components/visual/IconWell";
import { VerifiedCredentials } from "@/components/site/VerifiedCredentials";
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

// What each discipline does. Credentials are not typed here: they come from
// client/src/data/credentials.ts with the issuer's verification link.
const team = [
  {
    name: "Leadership & architecture",
    description:
      "The founder leads every Cyber Risk Assessment and the architecture that follows, and stays involved in the milestones that matter.",
    icon: Trophy,
  },
  {
    name: "Security operations",
    description:
      "Detection and response for the DE Security Foundation, with emergency incident response available 24/7/365 under our published SLA.",
    icon: Shield,
  },
  {
    name: "Systems & infrastructure",
    description:
      "Microsoft 365, Google Workspace and Zoho workspaces, endpoints, networks and backup, run to the standard your plan sets.",
    icon: Briefcase,
  },
  {
    name: "Service desk",
    description:
      "Owns each ticket to resolution, with response targets by priority set in the SLA: 15 minutes for a critical incident.",
    icon: Users,
  },
];

export default function Team() {
  useSEO({
    title: "Our Team - IT & Security Experts in Chandler, AZ",
    description:
      "Meet the people behind Digerati Experts: cybersecurity, systems and service-desk work led by founder Joseph Petro, serving Arizona businesses from Chandler.",
    canonical: "/about/team",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="About · Team"
      title="Meet The Experts"
      subtitle="The IT and security people behind Digerati Experts, serving Chandler and the Phoenix metro area"
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
            title: "15-minute critical response",
            text: "Our published SLA response for an active breach or system down.",
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
            title="Four disciplines, one accountable owner"
            lede="Every discipline answers to the founder, so the person who scoped your environment is the person accountable for it."
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
            title="Credentials you can check"
            lede="Certifications, partner programs and ratings, each linked to the issuer's own record."
          />
          <VerifiedCredentials />
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
