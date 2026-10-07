import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileCheck,
  Monitor,
  Shield,
  TrendingUp,
} from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, ChapterHeader, ClosingCta, Container, HeroActions } from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { DocumentFlipbook } from "@/pages/resources/DocumentFlipbook";

const resources = [
  {
    name: "Digerati Journal",
    href: "/resources/blog",
    description: "Field notes on managed IT, cybersecurity, and Arizona business risk.",
    icon: BookOpen,
  },
  {
    name: "Case Studies",
    href: "/resources/case-studies",
    description: "How Arizona organizations engage DE for security-first IT.",
    icon: TrendingUp,
  },
  {
    name: "Cyber Facts",
    href: "/resources/cyber-facts",
    description: "Sourced statistics and credibility facts you can verify.",
    icon: Shield,
  },
  {
    name: "Security Updates",
    href: "/resources/security-updates",
    description: "Curated threat and vulnerability updates with dates and sources.",
    icon: FileCheck,
  },
  {
    name: "Videos & Webinars",
    href: "/resources/videos",
    description: "Educational sessions for owners, operators, and IT partners.",
    icon: Monitor,
  },
  {
    name: "Downtime Calculator",
    href: "/resources/downtime-calculator",
    description: "Estimate what downtime actually costs your business.",
    icon: BarChart3,
  },
  {
    name: "Security Checklist",
    href: "/resources/security-checklist",
    description: "A practical posture checklist before you talk to any MSP.",
    icon: ClipboardCheck,
  },
  {
    name: "Datasheets",
    href: "/resources/datasheets",
    description: "Downloadable package overviews, checklists, and sample reports.",
    icon: FileCheck,
  },
  {
    name: "Executive briefs",
    href: "/resources/briefs",
    description: "Short operating notes for buyers — cyber risk, recovery, insurance, ProActive.",
    icon: BookOpen,
  },
  {
    name: "Document Flipbook",
    href: "/resources#document-flipbook",
    description: "Open a PDF locally in your browser and read it as a responsive digital book.",
    icon: BookOpen,
  },
  {
    name: "Campaign offers",
    href: "/go",
    description: "Single-offer pages for search and social — one path, one primary CTA.",
    icon: Shield,
  },
];

const groups: { title: string; lede: string; hrefs: string[] }[] = [
  {
    title: "Read and learn",
    lede: "Field notes, sourced facts and sessions you can verify.",
    hrefs: [
      "/resources/blog",
      "/resources/case-studies",
      "/resources/cyber-facts",
      "/resources/security-updates",
      "/resources/videos",
    ],
  },
  {
    title: "Tools",
    lede: "Work something out for your own business before you talk to anyone.",
    hrefs: ["/resources/downtime-calculator", "/resources/security-checklist", "/resources#document-flipbook"],
  },
  {
    title: "Buyer documents",
    lede: "Downloadable overviews and single-offer pages.",
    hrefs: ["/resources/datasheets", "/resources/briefs", "/go"],
  },
];

function ResourceRow({ resource }: { resource: (typeof resources)[number] }) {
  const Icon = resource.icon;
  return (
    <Link
      href={resource.href}
      className="de-interactive-card group flex min-h-11 items-start gap-4 border-b border-[var(--de-hairline)] py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec4899]"
    >
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-de-hairline bg-de-raised text-de-accent-ink">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-lg font-semibold leading-snug text-white">{resource.name}</span>
        <span className="mt-1 block text-base leading-relaxed text-white/70">{resource.description}</span>
        <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-de-accent-ink">
          Open resource
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

export default function ResourcesIndex() {
  useSEO({
    title: "Resources",
    description:
      "Cybersecurity and managed IT resources from Digerati Experts — journal, case studies, calculators, checklists, and security updates.",
    canonical: "/resources",
  });

  return (
    <PageTemplate
      title="Resources"
      eyebrow="Journal, tools and documents"
      subtitle="Practical guidance, tools, and updates — without the generic MSP brochure language."
      breadcrumbs={[{ label: "Resources" }]}
      layout="chapters"
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      <Chapter tone="well" seam={false}>
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="The library"
            title="Find what you need"
            lede="Eleven places to read, calculate, check and download — grouped by what you are trying to do."
          />
          <div className="border-t border-[var(--de-hairline)]">
            {groups.map((g) => (
              <div
                key={g.title}
                className="grid gap-x-10 border-b border-[var(--de-hairline)] py-8 lg:grid-cols-12 lg:py-10"
              >
                <div className="lg:col-span-4">
                  <h2 className="font-heading text-xl font-semibold text-white md:text-2xl">{g.title}</h2>
                  <p className="mt-2 max-w-xs text-base leading-relaxed text-white/65">{g.lede}</p>
                </div>
                <div className="grid gap-x-10 border-t border-[var(--de-hairline)] sm:grid-cols-2 lg:col-span-8 lg:border-t-0">
                  {g.hrefs.map((href) => {
                    const r = resources.find((x) => x.href === href)!;
                    return <ResourceRow key={href} resource={r} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Chapter>

      <Chapter plate="resources" tone="surface">
        <Container>
          <DocumentFlipbook />
        </Container>
      </Chapter>

      <ClosingCta
        tone="paper"
        eyebrow="Need a recommendation?"
        title="Need a recommendation, not a PDF?"
        lede="A Cyber Risk Assessment maps which resource — and which operating model — actually fits your Arizona business."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
