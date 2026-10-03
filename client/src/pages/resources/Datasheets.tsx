import { Link } from "wouter";
import { Download } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { RESOURCE_TYPE_LABEL, resources, resourceLandingMeta } from "@/data/resourceRegistry";
import { Chapter, ClosingCta, Container, HeroActions } from "@/components/site/chapters";

export default function Datasheets() {
  useSEO({
    title: "Datasheets, checklists, and sample reports",
    description:
      "Download Digerati Experts datasheets for ProActive packages, co-managed IT, UCaaS, checklists, and sample assessment reports. No fabricated case studies.",
    canonical: "/resources/datasheets",
  });

  return (
    <PageTemplate
      title="Datasheets & documentation"
      eyebrow="Downloads"
      subtitle="The files that already ship with the site — package overviews, checklists, and sample reports. Nothing here invents a customer or a certification."
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Datasheets" }]}
      layout="chapters"
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <ol className="divide-y divide-[var(--de-paper-hairline)] border-y border-[var(--de-paper-hairline)]">
            {resources.map((resource, index) => {
              const meta = resourceLandingMeta[resource.slug];
              return (
                <li key={resource.slug} className="grid gap-4 py-7 md:grid-cols-[4rem_1fr_auto] md:items-start md:gap-8">
                  <span className="font-mono text-sm font-semibold text-de-magenta-paper-ink">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/65">
                      {RESOURCE_TYPE_LABEL[resource.type]}
                    </p>
                    <h2 className="mt-2 font-heading text-xl font-semibold text-[#1A1228]">
                      <Link
                        href={resource.route}
                        className="inline-flex min-h-11 items-center rounded-sm hover:text-de-magenta-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                      >
                        {resource.title}
                      </Link>
                    </h2>
                    {meta && (
                      <p className="max-w-2xl text-base leading-relaxed text-[#3A3448]">{meta.tagline}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                    <Button asChild variant="brand" className="min-h-11">
                      <a href={resource.file} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                        {resource.cta}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="min-h-11 border-[var(--de-paper-hairline)] bg-white text-[#1A1228] hover:bg-[var(--de-paper)] hover:text-[#1A1228]"
                    >
                      <Link href={resource.route} aria-label={`Details: ${resource.title}`}>Details</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-8 max-w-3xl text-base leading-relaxed text-[#3A3448]">
            Looking for a longer read?{" "}
            <Link href="/resources/briefs" className="font-medium text-de-magenta-paper-ink underline underline-offset-4">
              Executive briefs
            </Link>{" "}
            and the{" "}
            <Link
              href="/resources/ebook/defending-digital-realm"
              className="font-medium text-de-magenta-paper-ink underline underline-offset-4"
            >
              Defending the Digital Realm
            </Link>{" "}
            ebook sit alongside these files.
          </p>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Need a recommendation, not another PDF?"
        lede="The Cyber Risk Assessment maps which datasheet — and which operating model — actually fits."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
