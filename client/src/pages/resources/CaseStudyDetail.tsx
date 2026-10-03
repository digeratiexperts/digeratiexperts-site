import { PageTemplate } from "@/components/PageTemplate";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { Link, useParams } from "wouter";
import { ArrowLeft, Info } from "lucide-react";
import { caseStudyBySlug } from "@/data/caseStudies";
import { Chapter, CheckList, ClosingCta, Container, Eyebrow, Prose, textLinkClass } from "@/components/site/chapters";
import { CTA } from "@/lib/ctaCopy";

export default function CaseStudyDetail() {
  const params = useParams<{ slug: string }>();
  const study = caseStudyBySlug(params.slug || "");

  useSEO({
    title: study ? study.title : "Case Study",
    description: study?.summary || "Digerati Experts case study structure.",
    canonical: study ? `/resources/case-studies/${study.slug}` : "/resources/case-studies",
  });

  if (!study) {
    return (
      <PageTemplate
        title="Case study not found"
        subtitle="That story isn’t published yet."
        breadcrumbs={[
          { label: "Resources", href: "/resources" },
          { label: "Case Studies", href: "/resources/case-studies" },
          { label: "Not found" },
        ]}
      >
        <Link
          href="/resources/case-studies"
          className="inline-flex min-h-11 items-center gap-2 text-de-accent-ink hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to case studies
        </Link>
      </PageTemplate>
    );
  }

  const sections = [
    { title: "Challenge", body: study.challenge },
    { title: "Approach", body: study.approach },
    { title: "Outcome", body: study.outcome },
  ];

  return (
    <PageTemplate
      title={study.title}
      eyebrow="Case study"
      subtitle={study.summary}
      breadcrumbs={[
        { label: "Resources", href: "/resources" },
        { label: "Case Studies", href: "/resources/case-studies" },
        { label: study.industry },
      ]}
      layout="chapters"
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <Prose tone="paper">
            <div className="flex flex-wrap gap-2">
              <Badge className="border border-[var(--de-paper-hairline)] bg-white text-[#1A1228]">{study.industry}</Badge>
              {study.status === "sample" ? (
                <Badge className="border border-[var(--de-paper-hairline)] bg-transparent text-[#3A3448]">
                  Coming soon / Sample structure
                </Badge>
              ) : (
                <Badge className="border border-[var(--de-paper-hairline)] bg-white text-de-magenta-paper-ink">
                  Approved client story
                </Badge>
              )}
              {study.clientLabel && (
                <Badge className="border border-[var(--de-paper-hairline)] bg-white text-de-magenta-paper-ink">
                  {study.clientLabel}
                </Badge>
              )}
            </div>

            {study.status === "sample" && (
              <div className="mt-8 flex gap-3 rounded-xl border border-[var(--de-paper-hairline)] bg-white p-5">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
                <p className="text-base leading-relaxed text-[#3A3448]">
                  This page is a labeled structure shell. Placeholders are waiting for DE-approved copy — no
                  fabricated customer names or ROI metrics.
                </p>
              </div>
            )}

            <div className="mt-10 divide-y divide-[var(--de-paper-hairline)] border-y border-[var(--de-paper-hairline)]">
              {sections.map((section, i) => (
                <section key={section.title} className="py-8">
                  <Eyebrow tone="paper" className="mb-3">
                    {String(i + 1).padStart(2, "0")}
                  </Eyebrow>
                  <h2 className="font-heading text-2xl font-semibold text-[#1A1228]">{section.title}</h2>
                  <p className="mt-3 text-lg leading-[1.75] text-[#3A3448]">{section.body}</p>
                </section>
              ))}
              <section className="py-8">
                <Eyebrow tone="paper" className="mb-3">
                  04
                </Eyebrow>
                <h2 className="mb-5 font-heading text-2xl font-semibold text-[#1A1228]">Stack</h2>
                <CheckList items={study.stack} tone="paper" columns={1} />
              </section>
            </div>

            <Link
              href="/resources/case-studies"
              className={`${textLinkClass("paper")} mt-6`}
              data-testid="link-back-case-studies"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All case studies
            </Link>
          </Prose>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Discuss an engagement like this"
        lede="We publish client stories with permission. Start with an assessment to see whether this structure fits your environment."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
