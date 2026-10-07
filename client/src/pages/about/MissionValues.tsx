import { PageTemplate } from "@/components/PageTemplate";
import { ParallaxStill } from "@/components/visual/ParallaxStill";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  FactStrip,
  FeatureGrid,
  HeroActions,
  Eyebrow,
} from "@/components/site/chapters";
import { Heart, MapPin, Target, Users, Shield, Clock, Award, Star, Layers, Building2 } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
// 37KB WebP sized for the ~448px frame (was a 2.1MB PNG) — review finding F2.
import officeEveningImg from "@assets/de-arizona-office-evening-960.webp";

const values = [
  {
    icon: Shield,
    title: "Security First",
    description:
      "We believe every business deserves enterprise-level security, regardless of size. We stay ahead of threats so you don't have to.",
  },
  {
    icon: Users,
    title: "Partnership",
    description:
      "We're not just your IT provider – we're your technology partner. Your success is our success, and we're invested in your long-term growth.",
  },
  {
    icon: Target,
    title: "Proactive Approach",
    description:
      "We prevent problems before they happen. Our proactive monitoring and maintenance keep your systems running smoothly 24/7.",
  },
  {
    icon: Heart,
    title: "Local Commitment",
    description:
      "Based in Chandler, Arizona, we're proud to serve businesses throughout the Phoenix metro area with personalized, local support.",
  },
];

const differentiators = [
  {
    icon: Users,
    title: "Human-First Technology",
    desc: "While we use advanced tools and automation, every client has a dedicated team of real people who know your business.",
  },
  {
    icon: Award,
    title: "Compliance Expertise",
    desc: "We specialize in helping businesses meet complex compliance requirements like HIPAA, PCI DSS, and SOC 2.",
  },
  {
    icon: Star,
    title: "Transparent Pricing",
    desc: "No hidden fees, no surprises. You'll always know exactly what you're paying for and why.",
  },
  {
    icon: Clock,
    title: "15-Minute Critical Response",
    desc: "When a breach is active or a system is down, our published SLA sets a 15-minute response, with emergency incident response available 24/7/365.",
  },
];

export default function MissionValues() {
  useSEO({
    title: "Mission & Values - Our Commitment",
    description:
      "Digerati Experts mission and core values. Security-first IT, local partnership, and proactive protection for Arizona businesses.",
    canonical: "/about/mission-values",
  });

  const facts = [
    { icon: MapPin, title: "Arizona", text: "Based in Chandler, serving Greater Phoenix." },
    { icon: Layers, title: "One operating model", text: "Accountable ownership across IT and security." },
    { icon: Building2, title: "MSP + MSSP", text: "IT and security delivered together." },
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="About · Mission & Values"
      title="Mission & Values"
      subtitle="Our commitment to partnership and protecting Arizona businesses."
      breadcrumbs={[{ label: "About" }, { label: "Mission & Values" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
      heroAside={
        /* Arizona environmental plate family the homepage uses, so the page reads principal-led and local. */
        <div className="relative flex aspect-[4/3] min-h-[16rem] overflow-hidden rounded-xl border border-[var(--de-hairline)] bg-[#0e0c13]">
          <ParallaxStill
            src={officeEveningImg}
            alt="Evening office environment representing Digerati Experts' Arizona operations"
            travel={6}
            width={448}
            height={300}
            className="absolute inset-0 opacity-90"
          />
          <div className="relative mt-auto w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-16">
            <p className="flex items-center gap-2 text-lg font-semibold text-white">
              <MapPin className="h-4 w-4 text-de-magenta-ink" aria-hidden="true" />
              Chandler, Arizona
            </p>
            <p className="mt-1 text-xs text-white/75">Principal-led · Serving Greater Phoenix</p>
          </div>
        </div>
      }
    >
      <FactStrip facts={facts} label="Where we operate" />

      <Chapter tone="well" seam={false}>
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <Eyebrow tone="well" className="mb-4">
                Our mission
              </Eyebrow>
              <h2 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-white md:text-4xl">
                Our Mission
              </h2>
            </div>
            <p className="max-w-[44ch] text-xl leading-relaxed text-white/85 md:text-2xl lg:col-span-8">
              To empower small and medium-sized businesses in Arizona with enterprise-grade IT security and support,
              making advanced cybersecurity accessible and affordable for organizations of all sizes.
            </p>
          </div>
        </Container>
      </Chapter>

      <Chapter plate="about" tone="paper">
        <Container>
          <ChapterHeader tone="paper" eyebrow="What we hold to" title="Our Core Values" />
          <FeatureGrid
            tone="paper"
            columns={2}
            items={values.map((v) => ({ icon: v.icon, title: v.title, text: v.description }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <ChapterHeader tone="surface" eyebrow="Difference" title="What Sets Us Apart" />
          <FeatureGrid
            tone="surface"
            columns={2}
            items={differentiators.map((d) => ({ icon: d.icon, title: d.title, text: d.desc }))}
          />
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        title="Ready to experience the difference?"
        lede="Start with a Cyber Risk Assessment — we’ll map risk and the right next step for your Arizona business."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
