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
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { Button } from "@/components/ui/button";
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
      subtitle="Practical guidance, tools, and updates — without the generic MSP brochure language."
      breadcrumbs={[{ label: "Resources" }]}
      actions={
        <Button asChild variant="brand" size="lg">
          <Link href="/book">{CTA.primary}</Link>
        </Button>
      }
    >
      <div className="pb-4">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => {
            const Icon = resource.icon;
            return (
              <li key={resource.href}>
                <Link
                  href={resource.href}
                  className="de-interactive-card group flex h-full flex-col rounded-2xl border border-de-hairline bg-de-raised p-6 focus-visible:outline-none"
                >
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-de-hairline bg-de-bg text-de-accent-ink">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-heading text-xl font-semibold text-white">{resource.name}</h2>
                  <p className="mt-2 flex-1 text-base leading-relaxed text-de-muted-soft">
                    {resource.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-de-accent-ink">
                    Open resource
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <DocumentFlipbook />

        <div className="mt-16">
          <ConversionPathBar
            headline="Need a recommendation, not a PDF?"
            body="A Cyber Risk Assessment maps which resource — and which operating model — actually fits your Arizona business."
          />
        </div>
      </div>
    </PageTemplate>
  );
}
