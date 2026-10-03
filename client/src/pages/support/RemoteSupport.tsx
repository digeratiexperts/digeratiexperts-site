import { PageTemplate } from "@/components/PageTemplate";
import { Shield, Clock, RefreshCw, Zap, Phone } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FactStrip,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  StepRail,
} from "@/components/site/chapters";

export default function RemoteSupport() {
  useSEO({
    title: "Remote Support | Digerati Experts",
    description:
      "Secure remote assistance from Digerati Experts technicians. Join a Zoho Assist session, open a ticket, or call support.",
    canonical: "/support/remote-support",
  });

  const features = [
    { icon: Clock, title: "Instant Connection", points: ["Connect in under 2 minutes", "No software required", "Windows, Mac, Linux"] },
    { icon: Shield, title: "Secure & Encrypted", points: ["End-to-end encryption", "Session recording", "HIPAA-aligned session controls"] },
    { icon: RefreshCw, title: "Screen Sharing", points: ["Full control capability", "Multi-monitor support", "File transfer included"] },
    { icon: Zap, title: "24/7 Emergency Response", points: ["Emergency incident response 24/7/365", "15-minute response for critical issues, per our SLA", "Senior engineer escalation"] },
  ];

  const steps = [
    { title: "Request Support", text: "Submit ticket or call our MSP team", meta: "< 1 min" },
    { title: "Share Access", text: "Secure connection established instantly", meta: "< 2 mins" },
    { title: "We Fix It", text: "Expert technicians resolve your issue", meta: "Fast" },
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Support · Remote Support"
      title="Remote Support"
      subtitle="Instant, secure remote assistance from our expert MSP technicians"
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Remote Support" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Open Zoho Assist", href: "https://assist.zoho.com/", testId: "button-zoho-assist-hero" }}
            secondary={{ label: "Submit Support Request", href: "/support/submit-ticket" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Session facts"
          rows={[
            { label: "Connection", value: "2 mins typical" },
            { label: "Critical response", value: "15 min (SLA)" },
            { label: "Availability", value: "24/7" },
            { label: "Sessions", value: "Encrypted (Zoho Assist)" },
          ]}
        />
      }
    >
      <FactStrip
        label="Remote support at a glance"
        facts={[
          { title: "2 mins", text: "Typical connection time" },
          { title: "15 min", text: "Critical response (SLA)" },
          { title: "24/7", text: "Availability" },
          { title: "Encrypted", text: "Zoho Assist sessions" },
        ]}
      />

      <Chapter tone="well" seam={false}>
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="How it works"
            title="How Remote Support Works"
            lede="When issues arise, our MSP technicians can securely access your systems to diagnose and resolve problems in minutes. No downtime, no delays."
          />
          <ul className="grid gap-4 md:grid-cols-2 md:gap-5">
            {features.map((feature) => (
              <li key={feature.title} className="rounded-xl border border-[var(--de-hairline)] bg-de-raised p-6">
                <feature.icon className="mb-4 h-5 w-5 text-de-magenta-ink" aria-hidden="true" />
                <h3 className="mb-4 font-heading text-lg font-semibold text-white">{feature.title}</h3>
                <CheckList tone="well" columns={1} items={feature.points} />
              </li>
            ))}
          </ul>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader tone="paper" eyebrow="Process" title="Simple 3-Step Process" />
          <StepRail tone="paper" steps={steps} />
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        eyebrow="Right now"
        title="Need Immediate Help?"
        lede="Join a secure Zoho Assist session with our MSP technicians, or open a ticket if you need us to reach out."
        showPhone={false}
        primary={{ label: "Open Zoho Assist", href: "https://assist.zoho.com/", testId: "button-zoho-assist-remote" }}
        secondary={{ label: "Submit Support Request", href: "/support/submit-ticket", testId: "button-submit-ticket-remote" }}
      />
      <Chapter tone="well" compact seam={false}>
        <Container>
          <a
            href={PRIMARY_PHONE.telHref}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
            data-testid="button-call-remote"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            Call Support
          </a>
        </Container>
      </Chapter>
    </PageTemplate>
  );
}
