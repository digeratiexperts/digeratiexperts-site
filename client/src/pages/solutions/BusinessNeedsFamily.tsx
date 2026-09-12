import { Link, useLocation, useParams } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, PackageCheck, Truck, Wrench } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import NotFound from "@/pages/not-found";
import {
  BUSINESS_NEEDS_INDEX_PATH,
  familyPath,
  getFamilyBySlug,
  offerForDelivery,
  SOLUTION_WORKSPACE_PATH,
} from "@/lib/businessNeeds";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { PublicSolutionCart } from "@/components/store/PublicSolutionCart";
import {
  addDraftNeed,
  patchSolutionDraft,
  profileSummary,
  readSolutionDraft,
  type DeliveryPreference,
} from "@/lib/solutionDraft";
import { assessmentPolicyLabel, buildSolutionPackage } from "@/lib/solutionPackage";
import { useToast } from "@/hooks/use-toast";

function OfferList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/55">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed text-white/75">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

const DELIVERY_OPTIONS: Array<[DeliveryPreference, string, string]> = [
  ["standalone", "Standalone", "Standard price · your business owns implementation and operation"],
  ["co_managed", "Co-Managed", "Preferred pricing · your team and DE share defined responsibilities"],
  ["unsure", "Help me choose", "Keep building and let DE recommend the right operating relationship"],
];

export default function BusinessNeedsFamily() {
  const params = useParams<{ family?: string }>();
  const family = getFamilyBySlug(params.family || "");
  const [delivery, setDelivery] = useState<DeliveryPreference | "">("");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!family) return;
    const draft = readSolutionDraft();
    setDelivery(
      draft.needs.find((need) => need.familyId === family.id)?.delivery || draft.deliveryPreference || "",
    );
  }, [family?.id]);

  const draft = readSolutionDraft();
  const offer = useMemo(() => {
    if (!family || (delivery !== "co_managed" && delivery !== "standalone")) return null;
    return offerForDelivery(family, delivery);
  }, [family, delivery]);
  const packageView = useMemo(() => {
    if (!family || (delivery !== "co_managed" && delivery !== "standalone")) return null;
    return buildSolutionPackage(family, delivery, draft.environment);
  }, [family, delivery, draft.environment]);

  useSEO(
    family
      ? {
          title: `${family.label} | Solve a Business Need`,
          description: family.description,
          canonical: familyPath(family.id),
        }
      : {
          title: "Page not found",
          description: "That solution family is not published.",
          noIndex: true,
        },
  );

  if (!family) {
    return <NotFound />;
  }

  const askAbout = () => {
    openMspAdvisor({
      context: "other",
      seedMessage: `I am reviewing the Digerati Experts ${family.label} solution and want to ask about package fit, implementation, pricing, and next steps.`,
    });
  };

  const addAndReview = () => {
    if (!delivery) return;
    addDraftNeed({ familyId: family.id, delivery });
    const current = readSolutionDraft();
    if (!current.deliveryPreference) patchSolutionDraft({ deliveryPreference: delivery });
    toast({ title: "Added to Your Solution", description: `${family.label} is ready to review.` });
    navigate(SOLUTION_WORKSPACE_PATH);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
      <StorePageAtmosphere />
      <div className="relative z-10">
        <MegaMenu />
        <main className="de-nav-clear mx-auto max-w-5xl px-4 pb-40 sm:px-6 lg:px-8">
          <Link
            href={BUSINESS_NEEDS_INDEX_PATH}
            className="mb-10 inline-flex h-11 items-center text-sm text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050312]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to pains & needs
          </Link>

          <header className="max-w-3xl pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-de-accent-ink">Step 2 · Solution</p>
            <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.035em] text-white" data-testid="heading-family">
              {family.label}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">{family.description}</p>
            <p className="mt-4 text-sm text-white/55">Profile: {profileSummary(draft.environment)}</p>
          </header>

          <section aria-labelledby="offer-type-heading">
            <h2 id="offer-type-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/55">
              Choose the operating relationship
            </h2>
            <div className="mb-8 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Choose an offer type">
              {DELIVERY_OPTIONS.map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={delivery === value}
                  className={`min-h-[7.25rem] rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] ${
                    delivery === value
                      ? "border-de-accent bg-de-accent/10 text-white"
                      : "border-white/10 bg-[#121212] text-white/75 hover:border-white/20"
                  }`}
                  onClick={() => setDelivery(value)}
                  data-testid={`delivery-${value}`}
                >
                  <span className="block font-semibold">{label}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-white/50">{description}</span>
                </button>
              ))}
            </div>
          </section>

          {packageView && offer ? (
            <article className="rounded-2xl border border-de-hairline bg-de-raised p-6 md:p-8" data-testid="offer-panel">
              <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                <div>
                  <p className="text-xs uppercase tracking-wide text-de-accent-ink">{packageView.relationshipLabel}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{packageView.offerName}</h2>
                  <p className="mt-4 max-w-2xl leading-relaxed text-white/75">{packageView.relationshipSummary}</p>
                </div>
                <aside className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/55">Commercial position</p>
                  <p className="mt-2 font-semibold text-white">{packageView.pricingLabel}</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/50">{assessmentPolicyLabel(packageView.assessmentPolicy)}</p>
                </aside>
              </div>

              <div className="mt-8 grid gap-8 md:grid-cols-2">
                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/55">What this helps you achieve</h3>
                  <ul className="space-y-2">
                    {offer.outcomes.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-relaxed text-white/75">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/55">Pre-configured package</h3>
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    {packageView.lineItems.map((line, index) => (
                      <div key={line.label} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-sm ${index ? "border-t border-white/10" : ""}`}>
                        <span className="text-white/75">{line.label}</span>
                        <span className="text-right text-white/55">{line.quantity}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <OfferList title="Prerequisites" items={offer.prerequisites} />
                <OfferList title="Scoped separately" items={offer.boundaries} />
              </div>

              <section className="mt-8 border-t border-white/10 pt-6" aria-labelledby="fulfillment-preview-heading">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-de-accent-ink">Step 3 preview</p>
                <h3 id="fulfillment-preview-heading" className="mt-2 text-xl font-semibold text-white">Delivery & setup</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 p-4">
                    <Truck className="h-5 w-5 text-de-accent-ink" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-white">Shipping / provisioning</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/55">{packageView.shipmentCopy}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-4">
                    <Wrench className="h-5 w-5 text-de-accent-ink" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-white">Technician</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/55">{packageView.technicianCopy}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-4">
                    <PackageCheck className="h-5 w-5 text-de-accent-ink" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-white">Remote support</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/55">{packageView.remoteSupportCopy}</p>
                  </div>
                </div>
              </section>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#121212] p-7 text-white/65">
              Choose Standalone, Co-Managed, or Help me choose. If you are unsure, DE can recommend the relationship after reviewing your profile and business need.
            </div>
          )}

          <section className="mt-8" aria-label="Solution actions">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button variant="brand" className="h-11" disabled={!delivery} data-testid="continue-building" onClick={addAndReview}>
                Add & review package
              </Button>
              <Button type="button" variant="outline" className="h-11 border-white/20 text-white hover:bg-white/10" onClick={askAbout} data-testid="ask-de-solution">
                Ask DE
              </Button>
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm text-white/50">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" />
              Standalone does not enroll you in managed IT. Co-managed means DE and your team share an approved responsibility model.
            </p>
          </section>
        </main>
        <PublicSolutionCart />
        <DigeratiEnhancedFooterSection />
      </div>
    </div>
  );
}
