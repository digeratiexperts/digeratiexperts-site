import { Link, useParams } from "wouter";
import { Download, Printer } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { briefBySlug, EXECUTIVE_BRIEFS } from "@/data/executiveBriefs";
import { resourceBySlug } from "@/data/resourceRegistry";
import { COMPANY } from "@/data/companyContact";
import { Breadcrumbs } from "@/components/site/chapters";
// The plain 404: the default export re-dispatches marketing paths back here (infinite loop on an unknown slug).
import { NotFoundPage as NotFound } from "@/pages/not-found";

export function ExecutiveBriefIndex() {
  useSEO({
    title: "Executive briefs",
    description:
      "Short Digerati Experts briefs on cyber risk, ransomware readiness, insurance preparation, and the ProActive operating model.",
    canonical: "/resources/briefs",
  });

  return (
    <div className="min-h-screen bg-de-paper">
      <MegaMenu />
      <main id="main-content" className="mx-auto max-w-3xl px-4 pb-12 pt-[calc(var(--de-nav-offset)+3rem)] sm:px-6 md:pb-16 md:pt-[calc(var(--de-nav-offset)+4rem)]">
        <Breadcrumbs tone="paper" items={[{ label: "Resources", href: "/resources" }, { label: "Executive briefs" }]} />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A30E52]">Digerati Experts</p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em] text-[#1A1228]">
          Executive briefs
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-black/65">
          Printable operating notes for buyers and advisors. No invented case studies. Pair a brief with the
          matching datasheet or assessment conversation.
        </p>
        <ol className="mt-12 divide-y divide-black/10 border-y border-black/10">
          {EXECUTIVE_BRIEFS.map((brief) => (
            <li key={brief.slug}>
              <Link
                href={`/resources/briefs/${brief.slug}`}
                className="group block py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec4899]"
              >
                <h2 className="font-heading text-2xl font-semibold text-[#1A1228] group-hover:text-[#A30E52]">
                  {brief.title}
                </h2>
                <p className="mt-2 text-base text-black/70">{brief.dek}</p>
                <p className="mt-2 text-sm text-black/60">{brief.readingMinutes} min read</p>
              </Link>
            </li>
          ))}
        </ol>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}

export default function ExecutiveBriefPage() {
  const params = useParams<{ slug?: string }>();
  const brief = briefBySlug(params.slug ?? "");

  if (!brief) {
    return <NotFound />;
  }

  const asset = brief.relatedAssetSlug ? resourceBySlug(brief.relatedAssetSlug) : undefined;

  useSEO({
    title: brief.seoTitle,
    description: brief.seoDescription,
    canonical: `/resources/briefs/${brief.slug}`,
  });

  return (
    <div className="de-brief-document min-h-screen bg-[#f7f5f2] text-[#1A1228]">
      <div className="print:hidden">
        <MegaMenu />
      </div>
      <article className="de-nav-clear print:pt-0">
        <header className="border-b border-black/10 bg-[#f7f5f2]">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-14">
            <div className="print:hidden">
              <Breadcrumbs
                tone="paper"
                items={[
                  { label: "Resources", href: "/resources" },
                  { label: "Executive briefs", href: "/resources/briefs" },
                  { label: brief.title },
                ]}
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A30E52]">
              {COMPANY.legalName} · Executive brief
            </p>
            <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              {brief.title}
            </h1>
            <p className="mt-5 text-xl leading-relaxed text-black/65">{brief.dek}</p>
            <p className="mt-6 text-sm text-black/65">
              For {brief.audience} · {brief.readingMinutes} minute read · Chandler, Arizona
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1A1228] underline decoration-black/20 underline-offset-4 hover:text-[#A30E52] print:hidden"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print or save as PDF
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className="space-y-8">
            {brief.body.map((block, index) => {
              if (block.kind === "h2") {
                return (
                  <h2 key={index} className="pt-4 font-heading text-2xl font-semibold">
                    {block.text}
                  </h2>
                );
              }
              if (block.kind === "ul") {
                return (
                  <ul key={index} className="space-y-3 pl-0">
                    {block.items.map((item) => (
                      <li key={item} className="border-l-2 border-[#D3126A] pl-4 leading-relaxed text-black/75">
                        {item}
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={index} className="text-lg leading-[1.75] text-black/80">
                  {block.text}
                </p>
              );
            })}
          </div>
          <div className="mt-14 flex flex-col gap-3 border-t border-black/10 pt-8 print:hidden sm:flex-row">
            <Button asChild variant="brand" className="h-auto min-h-12 whitespace-normal py-2 text-center">
              <Link href="/book">{CTA.primary}</Link>
            </Button>
            {brief.relatedCampaignSlug && (
              <Button asChild variant="outline" className="h-auto min-h-12 whitespace-normal border-black/20 py-2 text-center text-[#1A1228]">
                <Link href={`/go/${brief.relatedCampaignSlug}`}>Campaign page</Link>
              </Button>
            )}
            {asset && (
              <Button asChild variant="outline" className="h-auto min-h-12 whitespace-normal border-black/20 py-2 text-center text-[#1A1228]">
                <a href={asset.file} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  {asset.title}
                </a>
              </Button>
            )}
          </div>
        </div>
        <div className="bg-[#0a0a0a] px-4 py-16 print:hidden">
          <div className="mx-auto max-w-5xl">
            <ConversionPathBar
              headline="Turn the brief into a recommendation"
              body="Book the Cyber Risk Assessment conversation. We will not invent a package to match an ad."
            />
          </div>
        </div>
      </article>
      <div className="print:hidden">
        <DigeratiEnhancedFooterSection />
      </div>
    </div>
  );
}
