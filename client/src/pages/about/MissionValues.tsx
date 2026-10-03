import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { IconWell } from "@/components/visual/IconWell";
import { ParallaxStill } from "@/components/visual/ParallaxStill";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, Target, Users, Shield, Zap, Clock, Award, Star, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
// 37KB WebP sized for the ~448px frame (was a 2.1MB PNG) — review finding F2.
import officeEveningImg from "@assets/de-arizona-office-evening-960.webp";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

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
    title: "15-Minute Response",
    desc: "When you need help, we're there – with a 15-minute Critical first-response target per our SLA. Other priorities have longer targets.",
  },
];

export default function MissionValues() {
  useSEO({
    title: "Mission & Values - Our Commitment",
    description:
      "Digerati Experts mission and core values. Security-first IT, local partnership, and proactive protection for Arizona businesses.",
    canonical: "/about/mission-values",
  });

  return (
    <PageTemplate
      title="Mission & Values"
      subtitle="Our commitment to partnership and protecting Arizona businesses."
      icon={<Heart className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "About" }, { label: "Mission & Values" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
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
        {/* Mission statement paired with the same Arizona environmental plate
            family the homepage uses (ParallaxStill + framed still) so the
            page reads principal-led and local, not just a bare heading. */}
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-de-hairline bg-de-raised">
              <Zap className="h-8 w-8 text-de-accent-ink" aria-hidden="true" />
            </div>
            <h2 className="mb-6 text-3xl font-bold text-white">Our Mission</h2>
            <p className="text-xl leading-relaxed text-white/80">
              To empower small and medium-sized businesses in Arizona with enterprise-grade IT security and support,
              making advanced cybersecurity accessible and affordable for organizations of all sizes.
            </p>
          </div>
          <div className="relative flex aspect-[4/3] min-h-[16rem] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1a1522] to-[#0e0c13] shadow-2xl">
            <ParallaxStill
              src={officeEveningImg}
              alt="Evening office environment representing Digerati Experts' Arizona operations"
              travel={6}
              width={448}
              height={300}
              className="absolute inset-0 opacity-90"
            />
            <div className="relative mt-auto w-full bg-gradient-to-t from-black/95 via-black/60 to-transparent p-6 pt-16">
              <p className="flex items-center gap-2 text-lg font-bold text-white">
                <MapPin className="h-4 w-4 text-de-accent-ink" aria-hidden="true" />
                Chandler, Arizona
              </p>
              <p className="mt-1 text-xs text-white/75">Principal-led · Serving Greater Phoenix</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-10 text-center text-3xl font-bold text-white">Our Core Values</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <article key={value.title} className={`de-interactive-card p-6 md:p-8 ${cardClass}`}>
                  <IconWell icon={Icon} size="md" surface="dark" />
                  <h3 className="mt-4 text-2xl font-semibold text-white">{value.title}</h3>
                  <p className="mt-3 leading-relaxed text-white/70">{value.description}</p>
                </article>
              );
            })}
          </div>
        </div>

        <section className={`p-8 md:p-12 ${cardClass}`}>
          <h2 className="mb-8 text-3xl font-bold text-white">What Sets Us Apart</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {differentiators.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`flex gap-4 p-4 ${insetClass}`}>
                  <IconWell icon={Icon} size="sm" surface="dark" />
                  <div>
                    <h3 className="mb-1 font-semibold text-white">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-white/65">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className={`grid gap-4 p-8 md:grid-cols-3 ${cardClass}`}>
          <div className={`p-4 text-center ${insetClass}`}>
            <p className="text-lg font-semibold text-white">Arizona</p>
            <p className="mt-1 text-sm text-white/60">Based in Chandler, serving Greater Phoenix.</p>
          </div>
          <div className={`p-4 text-center ${insetClass}`}>
            <p className="text-lg font-semibold text-white">One operating model</p>
            <p className="mt-1 text-sm text-white/60">Accountable ownership across IT and security.</p>
          </div>
          <div className={`p-4 text-center ${insetClass}`}>
            <p className="text-lg font-semibold text-white">MSP + MSSP</p>
            <p className="mt-1 text-sm text-white/60">IT and security delivered together.</p>
          </div>
        </div>

        <ConversionPathBar
          headline="Ready to experience the difference?"
          body="Start with a Cyber Risk Assessment — we’ll map risk and the right next step for your Arizona business."
        />
      </div>
    </PageTemplate>
  );
}
