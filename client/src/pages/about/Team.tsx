import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { Shield, Award, Briefcase, Users, Star, Trophy, CheckCircle, ArrowRight } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { photography } from "@/lib/visualAssets";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

const team = [
  {
    name: "Leadership Team",
    description: "Industry veterans with decades of combined experience in IT and cybersecurity",
    certifications: ["CISSP", "CISM", "Microsoft Certified", "CompTIA Security+"],
    icon: Trophy,
  },
  {
    name: "Security Engineers",
    description: "Specialized cybersecurity experts protecting your business 24/7",
    certifications: ["CEH", "GIAC", "OSCP", "Security+"],
    icon: Shield,
  },
  {
    name: "System Engineers",
    description: "Infrastructure experts ensuring your systems run smoothly",
    certifications: ["MCSE", "VMware VCP", "AWS Certified", "Azure Administrator"],
    icon: Briefcase,
  },
  {
    name: "Support Team",
    description: "Friendly, responsive technicians ready to help when you need it",
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
      title="Meet The Experts"
      subtitle="Our certified team of IT and security professionals serving Chandler and the Phoenix metro area"
      icon={<Users className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "About" }, { label: "Team" }]}
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
        <p className="mx-auto max-w-3xl text-center text-xl leading-relaxed text-white/80">
          Our team brings together decades of experience in IT management, cybersecurity, and business technology.
          We&apos;re passionate about protecting Arizona businesses and helping them succeed with technology.
        </p>

        {photography.founderHeadshot.available && (
          <div className={`mx-auto max-w-3xl p-6 md:p-8 ${cardClass}`} data-testid="founder-spotlight">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <picture>
                <source srcSet={photography.founderHeadshot.src} type="image/webp" />
                <img
                  src={photography.founderHeadshot.srcPng}
                  alt={photography.founderHeadshot.alt}
                  width={160}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  className="h-36 w-36 rounded-2xl border border-de-hairline object-cover sm:h-40 sm:w-40"
                />
              </picture>
              <div className="text-center sm:text-left">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-de-accent-ink">Founder</p>
                <h2 className="mb-2 text-2xl font-bold text-white">Joseph Petro</h2>
                <p className="leading-relaxed text-white/75">
                  Principal-led cybersecurity and managed IT for Arizona businesses — accountable recommendations from
                  the people who stand behind the work.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {team.map((group) => {
            const Icon = group.icon;
            return (
              <article key={group.name} className={`de-interactive-card p-6 md:p-8 ${cardClass}`}>
                <IconWell icon={Icon} size="md" surface="dark" />
                <h3 className="mt-4 text-2xl font-semibold text-white">{group.name}</h3>
                <p className="mt-3 leading-relaxed text-white/70">{group.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="rounded-md border border-de-hairline bg-de-bg px-3 py-1.5 text-sm text-white/80"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className={`grid gap-4 p-8 md:grid-cols-3 ${cardClass}`}>
          <div className={`p-4 text-center ${insetClass}`}>
            <p className="text-lg font-semibold text-white">24/7 monitoring</p>
            <p className="mt-1 text-sm text-white/60">Security operations coverage as documented in our SLA.</p>
          </div>
          <div className={`p-4 text-center ${insetClass}`}>
            <p className="text-lg font-semibold text-white">15-minute Critical response</p>
            <p className="mt-1 text-sm text-white/60">Critical means active breach or system down; other priorities have longer SLA targets.</p>
          </div>
          <div className={`p-4 text-center ${insetClass}`}>
            <p className="text-lg font-semibold text-white">Chandler, Arizona</p>
            <p className="mt-1 text-sm text-white/60">Local accountability for Phoenix-metro businesses.</p>
          </div>
        </div>

        <section className={`p-8 md:p-12 ${cardClass}`}>
          <div className="mb-8 flex items-center gap-3">
            <IconWell icon={Award} size="sm" surface="dark" />
            <h2 className="text-3xl font-bold text-white">Our Certifications & Partnerships</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {certCategories.map((category) => (
              <div key={category.title} className={`p-6 ${insetClass}`}>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                  <Star className="h-5 w-5 text-de-accent-ink" aria-hidden="true" />
                  {category.title}
                </h3>
                <ul className="space-y-3">
                  {category.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-white/75">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <ConversionPathBar
          headline="Ready to work with our team?"
          body="Schedule a Cyber Risk Assessment and meet the people who will protect your Arizona business."
        />
      </div>
    </PageTemplate>
  );
}
