import { PageTemplate } from "@/components/PageTemplate";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Info } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { allCaseStudiesForListing, type CaseStudy } from "@/data/caseStudies";
import { CTA } from "@/lib/ctaCopy";
import { Chapter, ClosingCta, Container, FactStrip, HeroActions } from "@/components/site/chapters";

const focusAreas = [
  { title: "Healthcare", text: "HIPAA & patient data" },
  { title: "Legal", text: "Ransomware recovery" },
  { title: "Accounting", text: "Insurance controls" },
  { title: "Industry", text: "OT & wire fraud" },
];

function StatusBadge({ study }: { study: CaseStudy }) {
  if (study.status === "published") {
    return <Badge className="border border-de-hairline bg-de-bg text-de-accent-ink">Approved client story</Badge>;
  }
  return <Badge className="border border-de-hairline bg-transparent text-white/70">Industry framework</Badge>;
}

const labelClass = "font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-accent-ink";

export default function CaseStudies() {
  useSEO({
    title: "Client Case Studies",
    description:
      "Arizona client case studies from Digerati Experts — challenge, approach, and outcome by industry.",
    canonical: "/resources/case-studies",
  });
  const caseStudies = allCaseStudiesForListing();
  const hasPublished = caseStudies.some((c) => c.status === "published");

  return (
    <PageTemplate
      title="Case Studies"
      eyebrow="Client stories"
      subtitle="Real Arizona engagements — challenge, approach, and outcome."
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Case Studies" }]}
      layout="chapters"
      actions={<HeroActions primary={{ label: CTA.primary, href: "/book" }} />}
    >
      <FactStrip facts={focusAreas} label="Industries covered" />

      <Chapter tone="well" seam={false}>
        <Container>
          {!hasPublished && (
            <div className="mb-10 flex gap-4 border-y border-[var(--de-hairline)] py-6 md:mb-12">
              <Info className="mt-1 h-5 w-5 shrink-0 text-de-accent-ink" aria-hidden="true" />
              <div>
                <p className="font-heading text-lg font-semibold text-white">Client stories in progress</p>
                <p className="mt-1 max-w-2xl text-base leading-relaxed text-white/70">
                  We publish case studies with client permission. Browse the frameworks below, or talk with us about
                  an engagement that matches your industry.
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--de-hairline)]">
            {caseStudies.map((study) => (
              <article
                key={study.slug}
                className="grid gap-8 border-b border-[var(--de-hairline)] py-10 lg:grid-cols-12 lg:gap-12 lg:py-12"
                data-testid={`case-study-card-${study.slug}`}
              >
                <div className="lg:col-span-5">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge study={study} />
                    <Badge className="border-0 bg-de-raised text-white/80">{study.industry}</Badge>
                  </div>
                  <h2 className="mt-5 font-heading text-2xl font-semibold leading-tight text-white md:text-3xl">
                    {study.title}
                  </h2>
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-white/70">{study.summary}</p>
                  <Link
                    href={`/resources/case-studies/${study.slug}`}
                    className="group mt-4 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-de-magenta-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
                    data-testid={`link-case-study-${study.slug}`}
                  >
                    View structure
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
                <dl className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:col-span-7">
                  {[
                    ["Challenge", study.challenge],
                    ["Approach", study.approach],
                    ["Outcome", study.outcome],
                  ].map(([label, text]) => (
                    <div key={label}>
                      <dt>
                        <h3 className={labelClass}>{label}</h3>
                      </dt>
                      <dd className="mt-2 text-[0.95rem] leading-relaxed text-white/75">{text}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>
                      <h3 className={labelClass}>Stack</h3>
                    </dt>
                    <dd>
                      <ul className="mt-2 space-y-1.5">
                        {study.stack.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-[0.95rem] text-white/75">
                            <span aria-hidden="true" className="mt-[0.6rem] h-1.5 w-3 shrink-0 rounded-full bg-[#D3126A]" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="paper"
        title="Ready to discuss your environment?"
        lede="Book an assessment — we’ll map challenges to a practical approach before asking you to buy a stack."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
