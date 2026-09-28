import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ASSESSMENT_LABELS, PRICING_LABELS, type SolutionLineItem, type SolutionPackageView } from "@/lib/solutionPackage";

export type PackagePair = { standalone: SolutionPackageView; coManaged: SolutionPackageView };

function isPair(view: SolutionPackageView | PackagePair): view is PackagePair {
  return "standalone" in view && "coManaged" in view;
}

/**
 * Hairline rows: label | Oxanium quantity. When the profile is not complete the
 * quantity is the basis phrase in the buyer's words; when it completes the
 * numbers settle once (the object reacting to the buyer's own facts).
 */
export function SheetRows({
  lineItems,
  sized,
  settle = false,
  className = "",
}: {
  lineItems: SolutionLineItem[];
  sized: boolean;
  settle?: boolean;
  className?: string;
}) {
  return (
    <ul className={`d2-sheet__rows ${className}`}>
      {lineItems.map((line, index) => {
        const basisOnly = !sized && line.basis !== "once";
        return (
          <li key={`${line.label}-${index}`} className="d2-sheet__row">
            <span className="d2-sheet__row-label">{line.label}</span>
            <span
              className={`d2-sheet__row-qty d2-qty${basisOnly ? " d2-sheet__row-qty--basis" : ""}`}
              data-d2-settle={settle && index < 8 ? "true" : undefined}
              style={settle ? ({ "--d2-i": index } as React.CSSProperties) : undefined}
            >
              {line.quantity}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SheetHead({
  eyebrow,
  title,
  meta,
  badge,
  headingLevel,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta: ReactNode[];
  badge?: string;
  headingLevel: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <div className="d2-sheet__head">
      <div className="min-w-0">
        {eyebrow ? <p className="d2-label d2-ink-soft mb-1">{eyebrow}</p> : null}
        <Heading className="d2-h3">{title}</Heading>
        <p className="d2-sheet__meta d2-small mt-1">
          {meta.map((entry, index) => (
            <span key={index}>{entry}</span>
          ))}
        </p>
      </div>
      {badge ? <span className="d2-sheet__badge d2-micro">{badge}</span> : null}
    </div>
  );
}

/**
 * One bill of materials, in four modes:
 * - single: the chosen relationship's package.
 * - compare: both relationships side by side, compact (Help me choose).
 * - preview: Standalone shown before a choice, badged.
 * - print: the same rows, no controls.
 */
export function PackageSheet({
  familyLabel,
  view,
  mode = "single",
  sized,
  pricingLabel,
  badge,
  changeHref,
  onRemove,
  removeLabel = "Remove",
  headingLevel = 3,
  swapKey,
  testId,
}: {
  familyLabel: string;
  view: SolutionPackageView | PackagePair;
  mode?: "single" | "compare" | "preview" | "print";
  sized: boolean;
  /** Override the pricing label (e.g. "DE confirms" while the relationship is open). */
  pricingLabel?: string;
  badge?: string;
  changeHref?: string;
  onRemove?: () => void;
  removeLabel?: string;
  headingLevel?: 2 | 3 | 4;
  /** Changing this cross-fades the sheet (relationship change). */
  swapKey?: string;
  testId?: string;
}) {
  // The quantities settle once when the profile becomes complete.
  const prevSized = useRef(sized);
  const [settle, setSettle] = useState(false);
  useEffect(() => {
    if (sized && !prevSized.current) {
      setSettle(true);
      const timer = window.setTimeout(() => setSettle(false), 700);
      prevSized.current = sized;
      return () => window.clearTimeout(timer);
    }
    prevSized.current = sized;
    return undefined;
  }, [sized]);

  // A relationship change cross-fades the sheet, never on first paint.
  const prevSwap = useRef(swapKey);
  const [swap, setSwap] = useState(false);
  useEffect(() => {
    if (swapKey !== prevSwap.current) {
      prevSwap.current = swapKey;
      setSwap(true);
      const timer = window.setTimeout(() => setSwap(false), 220);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [swapKey]);

  const foot =
    mode !== "print" && (changeHref || onRemove) ? (
      <div className="d2-sheet__foot d2-small">
        {changeHref ? (
          <Link href={changeHref} className="d2-action d2-action--quiet">
            Change need →
          </Link>
        ) : null}
        {onRemove ? (
          <button type="button" className="d2-action d2-action--quiet" onClick={onRemove}>
            {removeLabel}
          </button>
        ) : null}
      </div>
    ) : null;

  if (isPair(view)) {
    const columns: Array<[SolutionPackageView, string]> = [
      [view.standalone, PRICING_LABELS.standard],
      [view.coManaged, PRICING_LABELS.preferred],
    ];
    return (
      <article className="d2-sheet" data-d2-swap={swap ? "true" : undefined} data-testid={testId}>
        <SheetHead
          eyebrow={familyLabel}
          title={familyLabel}
          meta={[pricingLabel ?? PRICING_LABELS.unsure, ASSESSMENT_LABELS[view.standalone.assessmentPolicy]]}
          badge={badge}
          headingLevel={headingLevel}
        />
        <div className="d2-compare">
          {columns.map(([column, price]) => (
            <div key={column.offerId} className="d2-compare__col">
              <p className="d2-small d2-ink font-semibold">
                {column.relationshipLabel} · {price}
              </p>
              <p className="d2-small d2-ink-soft mt-1">{column.offerName}</p>
              <SheetRows lineItems={column.lineItems} sized={sized} settle={settle} className="mt-3" />
            </div>
          ))}
        </div>
        {foot}
      </article>
    );
  }

  return (
    <article className="d2-sheet" data-d2-swap={swap ? "true" : undefined} data-testid={testId}>
      <SheetHead
        eyebrow={familyLabel}
        title={view.offerName}
        meta={[pricingLabel ?? view.pricingLabel, ASSESSMENT_LABELS[view.assessmentPolicy]]}
        badge={badge}
        headingLevel={headingLevel}
      />
      <SheetRows lineItems={view.lineItems} sized={sized} settle={settle} />
      {foot}
    </article>
  );
}
