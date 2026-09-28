import { Link } from "wouter";
import type { CuratedSolutionFamily } from "@/data/curatedSolutions";
import { getScenarioById } from "@/data/solutionScenarios";
import type { SolutionDraftNeed } from "@/lib/solutionDraft";

/** One need in Your Solution: the family, where it came from, Change need, Remove. */
export function NeedRow({
  need,
  family,
  changeHref,
  onRemove,
  entered = false,
}: {
  need: SolutionDraftNeed;
  family: CuratedSolutionFamily;
  changeHref: string;
  onRemove: () => void;
  /** True for a row added after the page painted: it rises in; rows present at mount stand still (§9). */
  entered?: boolean;
}) {
  const scenario = need.source ? getScenarioById(need.source) : null;
  return (
    <li className="d2-need" data-testid={`need-row-${need.familyId}`} data-d2-entered={entered ? "true" : undefined}>
      <div className="min-w-0">
        <p className="d2-body font-semibold">{family.label}</p>
        <p className="d2-small d2-ink-soft mt-0.5">{family.description}</p>
        {scenario ? <p className="d2-need__source d2-micro mt-1">from: {scenario.title}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href={changeHref} className="d2-action d2-action--quiet">
          Change need<span aria-hidden="true"> →</span>
        </Link>
        <button type="button" className="d2-action d2-action--quiet" onClick={onRemove} aria-label={`Remove ${family.label}`}>
          Remove
        </button>
      </div>
    </li>
  );
}
