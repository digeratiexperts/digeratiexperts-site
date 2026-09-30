import { Link } from "wouter";
import { Download, FileText } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { RESOURCE_TYPE_LABEL, resources, resourceLandingMeta } from "@/data/resourceRegistry";

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
      subtitle="The files that already ship with the site — package overviews, checklists, and sample reports. Nothing here invents a customer or a certification."
      icon={<FileText className="h-10 w-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Datasheets" }]}
      actions={
        <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold">
          <Link href="/book">{CTA.primary}</Link>
        </Button>
      }
    >
      <div className="space-y-14">
        <ol className="divide-y divide-de-hairline border-y border-de-hairline">
          {resources.map((resource, index) => {
            const meta = resourceLandingMeta[resource.slug];
            return (
              <li key={resource.slug} className="grid gap-4 py-8 md:grid-cols-[4rem_1fr_auto] md:items-start">
                <span className="font-mono text-sm text-de-accent-ink">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                    {RESOURCE_TYPE_LABEL[resource.type]}
                  </p>
                  <h2 className="mt-2 font-heading text-xl font-semibold text-white">
                    <Link href={resource.route} className="hover:text-de-accent-ink">
                      {resource.title}
                    </Link>
                  </h2>
                  {meta && (
                    <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/60">{meta.tagline}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                  <Button asChild variant="brand" className="min-h-11">
                    <a href={resource.file} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      {resource.cta}
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="min-h-11 border-de-hairline text-white hover:bg-de-bg">
                    <Link href={resource.route}>Details</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-white/50">
          Looking for a longer read?{" "}
          <Link href="/resources/briefs" className="text-de-accent-ink underline underline-offset-4">
            Executive briefs
          </Link>{" "}
          and the{" "}
          <Link href="/resources/ebook/defending-digital-realm" className="text-de-accent-ink underline underline-offset-4">
            Defending the Digital Realm
          </Link>{" "}
          ebook sit alongside these files.
        </p>
        <ConversionPathBar
          headline="Need a recommendation, not another PDF?"
          body="The Cyber Risk Assessment maps which datasheet — and which operating model — actually fits."
        />
      </div>
    </PageTemplate>
  );
}
