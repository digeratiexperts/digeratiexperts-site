import { CheckCircle2 } from "lucide-react";
import { curatedSolutionFamilies, type CuratedSolutionOffer } from "@/data/curatedSolutions";
import type { StoreProduct } from "@/data/storeProducts";

interface StoreBundlesSectionProps {
  isLoggedIn: boolean;
  onAddBundle?: (products: StoreProduct[]) => void;
}

const deliveryLabels: Record<CuratedSolutionOffer["deliveryModel"], string> = {
  standalone: "Standalone",
  co_managed: "Co-managed",
};

function OfferCard({ offer }: { offer: CuratedSolutionOffer }) {
  return (
    <article
      className="rounded-xl border border-white/10 bg-black/20 p-4"
      data-de-jelly="feature"
      data-testid={`curated-offer-${offer.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-de-accent/40 bg-de-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-de-accent-ink">
          {deliveryLabels[offer.deliveryModel]}
        </span>
        <h4 className="text-base font-semibold text-white">{offer.name}</h4>
      </div>
      <p className="mt-2 text-sm leading-6 text-white/65">{offer.summary}</p>
      <p className="mt-3 text-sm text-white/75">
        <span className="font-semibold text-white">Best for:</span> {offer.audience}
      </p>
      <ul className="mt-3 space-y-2">
        {offer.outcomes.map((outcome) => (
          <li key={outcome} className="flex gap-2 text-sm text-white/75">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-de-accent-ink" />
            <span>{outcome}</span>
          </li>
        ))}
      </ul>
      <details className="mt-4 border-t border-white/10 pt-3 text-sm text-white/65">
        <summary className="cursor-pointer font-semibold text-white/85">Scope and service details</summary>
        <div className="mt-3 space-y-3">
          <div>
            <p className="font-semibold text-white/85">Included</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {offer.includes.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <p><span className="font-semibold text-white/85">Prerequisites:</span> {offer.prerequisites.join(" ")}</p>
          <p><span className="font-semibold text-white/85">Boundaries:</span> {offer.boundaries.join(" ")}</p>
          <p><span className="font-semibold text-white/85">Service level:</span> {offer.serviceLevel}</p>
          <p><span className="font-semibold text-white/85">Commercial model:</span> {offer.commercialModel}</p>
        </div>
      </details>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/55">
        Next step: {offer.nextStep}
      </p>
    </article>
  );
}

/**
 * Public, capability-led DE solution families. Operational implementation details stay private.
 */
export function StoreBundlesSection(_props: StoreBundlesSectionProps) {
  return (
    <section className="mb-12" data-testid="store-bundles">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white md:text-3xl">Curated DE solutions</h2>
        <p className="mt-1 max-w-4xl text-white/55">
          Choose a focused standalone service or extend your internal IT team with co-managed
          delivery. Every solution is confirmed through assessment and scope approval.
        </p>
      </div>
      <div className="space-y-5">
        {curatedSolutionFamilies.map((family) => (
          <section
            key={family.id}
            className="rounded-2xl border border-white/10 bg-[#141414] p-5"
            data-testid={`solution-family-${family.id}`}
          >
            <h3 className="text-xl font-semibold text-white">{family.label}</h3>
            <p className="mt-1 text-sm leading-6 text-white/55">{family.description}</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {family.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
