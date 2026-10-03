import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { SolutionScenario } from "@/data/solutionScenarios";
import { getFamilyById } from "@/lib/businessNeeds";

function label(id: string): string {
  return getFamilyById(id)?.label ?? id;
}

/**
 * A situation in the buyer's words that composes 2–3 families. The action
 * says exactly what it will do: "Add these 3", "2 of 3 already in · Add 1",
 * "All 3 in · Review Your Solution".
 */
export function ScenarioTile({
  scenario,
  compose,
  onStart,
  onReview,
  footer,
  revealIndex,
}: {
  scenario: SolutionScenario;
  compose: { add: string[]; alreadyIn: string[] };
  onStart: (scenario: SolutionScenario) => void;
  onReview: () => void;
  /** One in-flow line beneath the action (the incident scenarios carry the phone). */
  footer?: ReactNode;
  /** Position in the grid: staggers the scroll reveal of the row. */
  revealIndex?: number;
}) {
  // The press/settle of the jelly tier keys on a transient attribute set on the tap, never on steady state (§9).
  const [justSelected, setJustSelected] = useState(false);
  useEffect(() => {
    if (!justSelected) return;
    const timer = window.setTimeout(() => setJustSelected(false), 340);
    return () => window.clearTimeout(timer);
  }, [justSelected]);
  const total = scenario.familyIds.length;
  const allIn = compose.add.length === 0;
  const someIn = compose.alreadyIn.length > 0 && !allIn;
  const actionLabel = allIn
    ? `All ${total} in · Review Your Solution`
    : someIn
      ? `${compose.alreadyIn.length} of ${total} already in · Add ${compose.add.length}`
      : `Add these ${total}`;
  return (
    <li className={`d2-cell d2-scenario${allIn ? " d2-cell--added" : ""}`} data-testid={`scenario-${scenario.id}`} data-state={allIn ? "added" : "idle"}
      data-d2-reveal=""
      style={revealIndex !== undefined ? ({ "--d2-delay": `${(revealIndex % 2) * 70}ms` } as CSSProperties) : undefined}
    >
      <h3 className="d2-cell__title">{scenario.title}</h3>
      <p className="d2-cell__detail d2-scenario__pressure d2-small">{scenario.pressure}</p>
      <p className="d2-scenario__marks d2-micro d2-ink-soft mt-2">{scenario.familyIds.map(label).join(" · ")}</p>
      <div className="d2-cell__actions">
        <button
          type="button"
          className={`d2-action d2-action--sm ${allIn ? "d2-action--quiet" : "d2-action--secondary"}`}
          onClick={() => {
            setJustSelected(true);
            if (allIn) onReview();
            else onStart(scenario);
          }}
          data-testid={`scenario-${scenario.id}-action`}
          data-de-jelly-choice=""
          data-de-just-selected={justSelected ? "true" : undefined}
        >
          {actionLabel}
        </button>
      </div>
      {footer ? <div className="d2-small d2-ink-soft mt-3">{footer}</div> : null}
    </li>
  );
}
