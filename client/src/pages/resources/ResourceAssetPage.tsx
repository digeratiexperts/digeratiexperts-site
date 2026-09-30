import { Link, useParams } from "wouter";
import { Download, ArrowRight } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { RESOURCE_TYPE_LABEL, resourceBySlug, resourceLandingMeta } from "@/data/resourceRegistry";
import NotFound from "@/pages/not-found";

export default function ResourceAssetPage() {
  const params = useParams<{ slug?: string }>();
  const resource = resourceBySlug(params.slug ?? "");

  if (!resource) {
    return <NotFound />;
  }

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
      subtitle={meta?.tagline}
      breadcrumbs={[
        { label: "Resources", href: "/resources" },
        { label: "Datasheets & documentation", href: "/resources/datasheets" },
        { label: resource.title },
      ]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
            <a href={resource.file} target="_blank" rel="noopener noreferrer" data-testid="asset-download">
              <Download className="mr-2 h-4 w-4" />
              {resource.cta}
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 border-white/20 px-6 text-white hover:bg-white/10">
            <Link href="/book">{CTA.primary}</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-14">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-de-accent-ink">{typeLabel}</p>
        {meta && (
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">
                Who it is for
                <span className="text-de-accent-ink" aria-hidden="true">
                  :
                </span>
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/70">{meta.forWho}</p>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold text-white">
                What is inside
                <span className="text-de-accent-ink" aria-hidden="true">
                  :
                </span>
              </h2>
              <ul className="mt-3 space-y-3">
                {meta.inside.map((item) => (
                  <li key={item} className="border-l border-[#D3126A] pl-4 text-base leading-relaxed text-white/70">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {meta?.positioning && (
          <p className="max-w-3xl text-base leading-relaxed text-white/55">{meta.positioning}</p>
        )}
        <p className="text-sm text-white/55">
          Draft public resource. No fabricated customer stories. Request a live walkthrough if you need this
          applied to your environment.
        </p>
        <ConversionPathBar
          headline="Need this applied to your environment?"
          body="A Cyber Risk Assessment turns the datasheet into a recommendation with ownership named."
          extraAction={
            <Button asChild variant="outline" className="h-12 border-white/70 bg-transparent text-white hover:bg-white/10">
              <a href={resource.file} target="_blank" rel="noopener noreferrer">
                Download PDF
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          }
        />
      </div>
    </PageTemplate>
  );
}
