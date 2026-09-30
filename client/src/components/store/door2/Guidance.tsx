import type { RelationshipSuggestion, SolutionHint } from "@/lib/solutionGuidance";
import { RELATIONSHIP_LABELS } from "@/lib/solutionPackage";

/**
 * A suggestion is shown with its input and its reason and is never applied
 * without a click: "Use this" sets it, "Not now" is remembered.
 */
export function SuggestionLine({
  suggestion,
  source = "Suggested from your profile",
  onUse,
  onDecline,
  used = false,
  testId = "suggestion-line",
}: {
  suggestion: RelationshipSuggestion;
  source?: string;
  onUse: () => void;
  onDecline: () => void;
  used?: boolean;
  testId?: string;
}) {
  return (
    <div className="d2-suggest d2-small" data-testid={testId}>
      <span className="d2-suggest__chip d2-micro">{source}</span>
      <span className="min-w-0">
        <strong className="d2-ink-strong">{RELATIONSHIP_LABELS[suggestion.value]}.</strong> {suggestion.reason}
      </span>
      {used ? (
        <span className="d2-accent-ink">Used ✓</span>
      ) : (
        <span className="flex flex-wrap gap-x-4">
          <button type="button" className="d2-action d2-action--quiet" onClick={onUse} data-testid={`${testId}-use`}>
            Use this
          </button>
          <button type="button" className="d2-action d2-action--quiet" onClick={onDecline} data-testid={`${testId}-decline`}>
            Not now
          </button>
        </span>
      )}
    </div>
  );
}

/** One "DE suggests next" row: title, the reason quoting the source family, one action, Dismiss. */
export function HintRow({
  hint,
  onAction,
  onDismiss,
}: {
  hint: SolutionHint;
  onAction: (hint: SolutionHint) => void;
  onDismiss: (hint: SolutionHint) => void;
}) {
  return (
    <div className="d2-hint" data-testid={`hint-${hint.id}`}>
      <div className="min-w-0">
        <p className="d2-small font-semibold">{hint.title}</p>
        <p className="d2-small d2-ink-soft mt-1">{hint.reason}</p>
      </div>
      <div className="d2-hint__actions">
        {hint.actionLabel && hint.action.type !== "none" ? (
          <button type="button" className="d2-action d2-action--secondary d2-action--sm" onClick={() => onAction(hint)}>
            {hint.actionLabel}
          </button>
        ) : null}
        <button type="button" className="d2-action d2-action--quiet" onClick={() => onDismiss(hint)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
