/**
 * The Digerati Box — the virtual equivalent of the box an MSP ships a prospect.
 *
 * SURFACE: this is marketing core (surface B in design/UI-STYLE-RULES.md), not
 * Journal. It lives at /the-box rather than under /resources precisely so it
 * does not inherit the amber Journal lock: graphite wells, warm paper relief,
 * white type, magenta punctuation, violet only as light.
 *
 * WHAT MAKES IT A BOX RATHER THAN A LINK LIST
 * A list of PDFs is a downloads page. A box is five compartments, opened in
 * the order a buyer actually works: where you stand, what you can fix this
 * week, what a full engagement covers, how we think, what it costs. One
 * compartment is open at a time, so the page keeps the feeling of lifting a
 * lid rather than scrolling a directory.
 *
 * TRUTH (Tier 0)
 * Every tile resolves to an artifact that already exists — a registry PDF, an
 * executive brief, a canonical pricing tier. There is no case study, logo,
 * testimonial, metric, client name or response time anywhere on this page,
 * because the resource registry's own note forbids them until permission and
 * measured outcomes exist. `digeratiBox.test.ts` fails the build if a
 * compartment ever promises something the site cannot hand over.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  Gauge,
  Layers,
  Receipt,
} from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { pricingTiers, formatPrice } from "@/data/pricing";
import {
  BOX_COMPARTMENTS,
  boxBriefs,
  boxItemCount,
  compartmentResources,
  recipientName,
  type CompartmentId,
} from "@/data/digeratiBox";

const COMPARTMENT_ICON: Record<CompartmentId, typeof FileText> = {
  assessment: Gauge,
  checklists: ClipboardCheck,
  ecosystems: Layers,
  briefing: BookOpen,
  numbers: Receipt,
};

export default function TheBox() {
  useSEO({
    title: "The Digerati Box | Digerati Experts",
    description:
      "Everything Digerati Experts would hand you before you hire anyone: a sample Cyber Risk Assessment, two checklists you can run yourself, the full service ladder, four executive briefs, and published rates.",
    canonical: "/the-box",
  });

  // Addressed TO someone, never a claim ABOUT them. Read once: the box does not
  // change under the reader, and re-reading on every render would let a
  // history change rewrite the page mid-visit.
  const recipient = useMemo(() => {
    if (typeof window === "undefined") return null;
    return recipientName(new URLSearchParams(window.location.search).get("for"));
  }, []);

  const { openBooking } = useBooking();
  const [open, setOpen] = useState<CompartmentId>("assessment");
  const briefs = boxBriefs();
  const itemCount = boxItemCount();

  return (
    <PageTemplate
      title="The Digerati Box"
      subtitle={
        recipient
          ? `Packed for ${recipient}${/[.!?]$/.test(recipient) ? "" : "."} Everything we would hand you before you hire anyone — including the parts that might talk you out of it.`
          : "Everything we would hand you before you hire anyone — including the parts that might talk you out of it."
      }
      variant="dark"
      breadcrumbs={[{ label: "The Box" }]}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="bg-[#D3126A] text-white hover:bg-[#b50f5a]"
            onClick={() => openBooking("the-box-hero")}
            data-testid="box-cta-hero"
          >
            {CTA.primary}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-de-hairline bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/contact">Talk to a person</Link>
          </Button>
        </div>
      }
    >
      {/* ---------------------------------------------------------- manifest */}
      <section className="bg-de-bg py-10 md:py-14 lg:py-16" aria-labelledby="box-manifest">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-de-muted-soft">
            Manifest
          </p>
          <h2
            id="box-manifest"
            className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl"
          >
            {itemCount} things<span className="text-[#D3126A]">,</span> and not one of them
            written to sell you
          </h2>
          <p className="mt-4 max-w-2xl text-de-muted-soft">
            Each one already exists — the same reports, checklists and datasheets we use with
            clients. Two of them are designed to be run without us. You will not find a case
            study, a client logo or a testimonial here: we do not publish those until the client
            has approved the scope and the outcome is measured.
          </p>

          {/* The compartments. One open at a time — a box, not a directory. */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="tablist" aria-label="Box compartments">
            {BOX_COMPARTMENTS.map((compartment) => {
              const Icon = COMPARTMENT_ICON[compartment.id];
              const isOpen = open === compartment.id;
              const count =
                compartment.id === "briefing"
                  ? briefs.length
                  : compartmentResources(compartment).length;
              return (
                <button
                  key={compartment.id}
                  type="button"
                  role="tab"
                  id={`box-tab-${compartment.id}`}
                  aria-selected={isOpen}
                  aria-controls={`box-panel-${compartment.id}`}
                  onClick={() => setOpen(compartment.id)}
                  data-testid={`box-tab-${compartment.id}`}
                  className={`flex min-h-11 flex-col items-start gap-2 rounded-xl border p-4 text-left transition duration-200 ease-out active:scale-[0.98] ${
                    isOpen
                      ? "border-[#D3126A] bg-de-raised"
                      : "border-de-hairline bg-de-raised/40 hover:bg-de-raised"
                  }`}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon
                      className={`h-5 w-5 ${isOpen ? "text-[#D3126A]" : "text-white/55"}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[11px] tracking-[0.14em] text-white/35">
                      {compartment.index}
                    </span>
                  </span>
                  <span className="text-sm font-semibold leading-snug text-white">
                    {compartment.name}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.12em] text-white/40">
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- the open compartment */}
      {BOX_COMPARTMENTS.map((compartment) => {
        if (compartment.id !== open) return null;
        const items = compartmentResources(compartment);
        return (
          <section
            key={compartment.id}
            id={`box-panel-${compartment.id}`}
            role="tabpanel"
            aria-labelledby={`box-tab-${compartment.id}`}
            /* de-prose-light is required, not decorative: PageTemplate wraps
               its children in .de-prose-dark, whose `.de-prose-dark h2` beats a
               single-class text utility on specificity. Without this the
               headings on a paper chapter render white on #f7f5f2. */
            className="de-prose-light bg-de-paper py-10 md:py-14 lg:py-16"
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-600">
                {compartment.index} · Inside
              </p>
              <h2 className="mt-3 max-w-3xl text-balance text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
                {compartment.name}
              </h2>
              <p className="mt-3 max-w-2xl text-neutral-700">{compartment.purpose}</p>

              {/* Briefs are prose, so they get a reading list rather than tiles. */}
              {compartment.id === "briefing" ? (
                <ul className="mt-8 grid gap-4 md:grid-cols-2">
                  {briefs.map((brief) => (
                    <li key={brief.slug}>
                      <Link
                        href={`/resources/briefs/${brief.slug}`}
                        className="group flex h-full flex-col rounded-2xl border border-de-paper-hairline bg-white p-5 transition duration-200 ease-out hover:-translate-y-0.5"
                        data-testid={`box-brief-${brief.slug}`}
                      >
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-600">
                          {brief.readingMinutes} min · {brief.audience}
                        </span>
                        <span className="mt-2 text-lg font-semibold leading-snug text-neutral-900">
                          {brief.title}
                        </span>
                        <span className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">
                          {brief.dek}
                        </span>
                        <span className="mt-4 inline-flex items-center text-sm font-semibold text-[#D3126A]">
                          Read the brief
                          <ArrowUpRight
                            className="ml-1 h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={item.route}
                        className="group flex h-full flex-col rounded-2xl border border-de-paper-hairline bg-white p-5 transition duration-200 ease-out hover:-translate-y-0.5"
                        data-testid={`box-item-${item.slug}`}
                      >
                        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-600">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.type}
                        </span>
                        <span className="mt-2 flex-1 text-base font-semibold leading-snug text-neutral-900">
                          {item.title}
                        </span>
                        <span className="mt-4 inline-flex items-center text-sm font-semibold text-[#D3126A]">
                          {item.cta}
                          <ArrowUpRight
                            className="ml-1 h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* The money, shown where the compartment is about money. Figures
                  come from client/src/data/pricing.ts — the canonical source the
                  quote engine and the Store both read, so this page cannot
                  drift from what a customer is actually charged. */}
              {compartment.id === "numbers" && (
                <div className="mt-10">
                  <h3 className="text-lg font-semibold text-neutral-900">Published rates</h3>
                  <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                    Per user per month, with a monthly minimum per site. These are the same
                    numbers in every quote we send.
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {pricingTiers.map((tier) => (
                      <Link
                        key={tier.id}
                        href={tier.learnMoreUrl}
                        className="group flex flex-col rounded-2xl border border-de-paper-hairline bg-white p-5 transition duration-200 ease-out hover:-translate-y-0.5"
                        data-testid={`box-tier-${tier.id}`}
                      >
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-600">
                          {tier.tier}
                        </span>
                        <span className="mt-1 text-base font-semibold text-neutral-900">
                          {tier.label}
                        </span>
                        <span className="mt-3 font-mono text-2xl text-neutral-900">
                          {formatPrice(tier.user)}
                          <span className="ml-1 text-xs text-neutral-600">/user/mo</span>
                        </span>
                        <span className="mt-1 text-xs text-neutral-600">
                          {formatPrice(tier.monthlyMinimum)}/mo site minimum
                        </span>
                        <span className="mt-3 text-sm leading-relaxed text-neutral-600">
                          {tier.idealBuyer}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <p className="mt-5 text-sm text-neutral-600">
                    Want the arithmetic for your own environment first?{" "}
                    <Link
                      href="/resources/downtime-calculator"
                      className="font-semibold text-[#D3126A] underline underline-offset-4"
                    >
                      Estimate what downtime already costs you
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* ------------------------------------------------------------ closing */}
      <section className="bg-de-bg py-10 md:py-14 lg:py-16" aria-labelledby="box-next">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2
            id="box-next"
            className="text-balance text-2xl font-semibold tracking-tight text-white md:text-3xl"
          >
            Read the box first<span className="text-[#D3126A]">.</span> Then decide whether we
            are worth a call
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-de-muted-soft">
            The assessment is the honest starting point either way: it tells you where you
            stand, and it is the same document we would work from.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-[#D3126A] text-white hover:bg-[#b50f5a]"
              onClick={() => openBooking("the-box-close")}
              data-testid="box-cta-close"
            >
              {CTA.primary}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-de-hairline bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/resources">Browse everything else</Link>
            </Button>
          </div>
        </div>
      </section>
    </PageTemplate>
  );
}
