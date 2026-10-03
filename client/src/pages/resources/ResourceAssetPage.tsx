import { useParams } from "wouter";
import { Download } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { RESOURCE_TYPE_LABEL, resourceBySlug, resourceLandingMeta } from "@/data/resourceRegistry";
import NotFound from "@/pages/not-found";
import {
  Chapter,
  CheckList,
  ClosingCta,
  Container,
  Eyebrow,
  HeroFacts,
  buttonPrimary,
  buttonSecondary,
} from "@/components/site/chapters";

export default function ResourceAssetPage() {
  const params = useParams<{ slug?: string }>();
  const resource = resourceBySlug(params.slug ?? "");

  if (!resource) {
    return <NotFound />;
  }
  // Hooks live in the view so an unknown slug's early return never changes
  // the hook order between renders (client-side navigation between slugs).
  return <ResourceAssetView resource={resource} />;
}

function ResourceAssetView({ resource }: { resource: NonNullable<ReturnType<typeof resourceBySlug>> }) {
  const meta = resourceLandingMeta[resource.slug];

  useSEO({
    title: resource.title,
    description: meta?.tagline ?? `${resource.title} from Digerati Experts.`,
    canonical: resource.route,
  });

  const typeLabel = RESOURCE_TYPE_LABEL[resource.type];

  return (
    <PageTemplate
      title={resource.title}
      eyebrow={typeLabel}
      subtitle={meta?.tagline}
      breadcrumbs={[
        { label: "Resources", href: "/resources" },
        { label: "Datasheets & documentation", href: "/resources/datasheets" },
        { label: resource.title },
      ]}
      layout="chapters"
      heroAside={
        <HeroFacts
          title="At a glance"
          rows={[
            { label: "Type", value: typeLabel },
            { label: "Format", value: "PDF download" },
            { label: "Status", value: "Draft public resource" },
          ]}
        />
      }
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={resource.file}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonPrimary("well")}
            data-testid="asset-download"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {resource.cta}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a href="/book" className={buttonSecondary("well")}>
            {CTA.primary}
          </a>
        </div>
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          {meta && (
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="lg:col-span-5">
                <Eyebrow tone="paper" className="mb-4">
                  Audience
                </Eyebrow>
                <h2 className="font-heading text-2xl font-semibold text-[#1A1228] md:text-3xl">
                  Who it is for
                  <span className="text-de-magenta-paper-ink" aria-hidden="true">
                    :
                  </span>
                </h2>
                <p className="mt-4 max-w-[60ch] text-lg leading-[1.7] text-[#3A3448]">{meta.forWho}</p>
              </div>
              <div className="lg:col-span-7">
                <Eyebrow tone="paper" className="mb-4">
                  Contents
                </Eyebrow>
                <h2 className="font-heading text-2xl font-semibold text-[#1A1228] md:text-3xl">
                  What is inside
                  <span className="text-de-magenta-paper-ink" aria-hidden="true">
                    :
                  </span>
                </h2>
                <div className="mt-5">
                  <CheckList items={meta.inside} tone="paper" columns={1} />
                </div>
              </div>
            </div>
          )}
          {meta?.positioning && (
            <div className="mt-12 border-t border-[var(--de-paper-hairline)] pt-6">
              <p className="max-w-3xl text-base leading-relaxed text-[#3A3448]">{meta.positioning}</p>
            </div>
          )}
          <p className="mt-6 text-sm text-[#4A445A]">
            Draft public resource. No fabricated customer stories. Request a live walkthrough if you need this
            applied to your environment.
          </p>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Need this applied to your environment?"
        lede="A Cyber Risk Assessment turns the datasheet into a recommendation with ownership named."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
        secondary={{ label: "Download PDF", href: resource.file }}
      />
    </PageTemplate>
  );
}
