import type { CuratedSolutionFamily } from "@/data/curatedSolutions";
import type { RelationshipSuggestion } from "@/lib/solutionGuidance";
import { ASSESSMENT_LABELS, buildSolutionPackage, PRICING_LABELS, publicBoundary, RELATIONSHIP_LABELS } from "@/lib/solutionPackage";
import type { SolutionEnvironment } from "@/lib/solutionDraft";
import { SheetRows } from "./PackageSheet";

const WHO_RUNS_IT = {
  standalone: "You, or your IT provider, run it. DE sets it up (remote first) or guides you through it.",
  co_managed:
    "Your IT team and DE, by an agreed responsibility split. Preferred pricing where sharing the work lowers DE's effort, never a blanket price cut.",
} as const;

const DE_ROLE = {
  standalone: "DE designs, builds and hands over this package. Separately selected implementation or support only.",
  co_managed: "DE and your IT team share day-to-day operation of this package under the approved responsibility split.",
} as const;

/**
 * Both ways of having a family, side by side on shared rules, sized from the
 * one profile. No relationship control here: the choice is made once on the
 * workspace with every package visible.
 */
export function RelationshipCompare({
  family,
  environment,
  sized,
  suggestion,
  current,
}: {
  family: CuratedSolutionFamily;
  environment: SolutionEnvironment;
  sized: boolean;
  suggestion?: RelationshipSuggestion | null;
  current?: "standalone" | "co_managed" | "unsure" | "";
}) {
  const columns = (["standalone", "co_managed"] as const).map((delivery) => {
    const offer = family.offers.find((entry) => entry.deliveryModel === delivery) ?? family.offers[0];
    const view = buildSolutionPackage(family, delivery, environment);
    return { delivery, offer, view };
  });

  return (
    <div className="d2-compare" data-testid="relationship-compare">
      {columns.map(({ delivery, offer, view }) => {
        const isCurrent = current === delivery;
        const isSuggested = suggestion?.value === delivery;
        return (
          <div
            key={delivery}
            className={`d2-compare__col${isCurrent ? " d2-compare__col--current" : ""}`}
            data-testid={`offer-panel-${delivery}`}
          >
            <p className="d2-label d2-ink-soft">
              {RELATIONSHIP_LABELS[delivery]} · {delivery === "standalone" ? PRICING_LABELS.standard : PRICING_LABELS.preferred}
            </p>
            <h3 className="d2-h3 mt-2">{view.offerName}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {isCurrent ? <span className="d2-sheet__badge d2-micro">Your choice</span> : null}
              {isSuggested ? (
                <span className="d2-sheet__badge d2-micro" title={suggestion?.reason}>
                  Suggested from your profile
                </span>
              ) : null}
            </div>
            {isSuggested && suggestion ? <p className="d2-small d2-ink-soft mt-2">{suggestion.reason}</p> : null}

            <div className="d2-compare__section mt-4">
              <h4 className="d2-label">Who runs it day to day</h4>
              <p className="d2-small d2-ink">{WHO_RUNS_IT[delivery]}</p>
            </div>
            <div className="d2-compare__section">
              <h4 className="d2-label">DE's role</h4>
              <p className="d2-small d2-ink">{DE_ROLE[delivery]}</p>
            </div>
            <div className="d2-compare__section">
              <h4 className="d2-label">What's included</h4>
              <SheetRows lineItems={view.lineItems} sized={sized} className="mt-2" />
            </div>
            <div className="d2-compare__section">
              <h4 className="d2-label">Before we start</h4>
              <ul className="d2-rows d2-small d2-ink">
                {offer.prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="d2-compare__section">
              <h4 className="d2-label">Not included</h4>
              <ul className="d2-rows d2-small d2-ink">
                {offer.boundaries.map((item, index) => (
                  <li key={item}>{publicBoundary(offer.id, index, item)}</li>
                ))}
              </ul>
            </div>
            <div className="d2-compare__section">
              <h4 className="d2-label">Assessment</h4>
              <p className="d2-small d2-ink">{ASSESSMENT_LABELS[view.assessmentPolicy]}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
