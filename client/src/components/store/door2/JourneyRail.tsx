import { Check } from "lucide-react";
import { STORE_JOURNEY_SENTENCE, STORE_STEPS, type StoreStepId } from "@/lib/businessNeeds";

/**
 * Six stations joined by a thick line (Joe, 2026-10-01, concept B): a ✓ on each ready step, a glowing
 * white station for the current one, numbered stations ahead. Its accessible name is the locked journey sentence.
 */
export function JourneyRail({ current, complete }: { current: StoreStepId; complete: ReadonlySet<StoreStepId> | StoreStepId[] }) {
  const done = complete instanceof Set ? complete : new Set(complete);
  return (
    <ol className="d2-journey" aria-label={STORE_JOURNEY_SENTENCE} data-testid="journey-rail">
      {STORE_STEPS.map((step) => {
        const state = step.id === current ? "current" : done.has(step.id) ? "complete" : "pending";
        return (
          <li key={step.id} className="d2-journey__step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="d2-journey__bar" aria-hidden="true" />
            <span className="d2-journey__node" aria-hidden="true">
              {state === "complete" ? <Check className="d2-journey__check" aria-hidden="true" /> : step.n}
            </span>
            <span className="d2-journey__label d2-micro">
              <span className="sr-only">{step.sr}{state === "complete" ? " · ready" : ""}</span>
              <span aria-hidden="true">{step.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
