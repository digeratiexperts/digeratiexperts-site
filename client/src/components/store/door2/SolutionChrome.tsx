import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAnnouncer } from "@/components/AccessibleAnnouncer";
import { Link } from "wouter";
import { ChevronUp, Layers } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDockHiddenWhileOpen } from "@/hooks/useDockHiddenWhileOpen";
import { useMinWidth } from "@/hooks/useSolutionDraft";
import { getFamilyById, SOLUTION_WORKSPACE_PATH, STORE_STEPS, type CuratedSolutionFamily, type StoreStepId } from "@/lib/businessNeeds";
import { addDraftNeed, isProfileComplete, readSolutionDraft, removeDraftNeed, type SolutionDraft } from "@/lib/solutionDraft";
import { HelpRow, StoreAction, UndoRow } from "./primitives";
import { ProfileLine } from "@/components/store/SolutionProfileForm";

/*
 * The persistent Your Solution chrome (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md
 * §5.6). One component tree, two bodies: a sticky SolutionRail at ≥ 1024 and
 * the Store's one fixed element, the SolutionBar, below it. Never both.
 */

export type SolutionStatusLine = {
  id: StoreStepId;
  state: "ready" | "gap" | "pending";
  text: string;
  /** Anchor of the section with the gap, so the status line takes the buyer there. */
  href?: string;
};

export type SolutionPrimary = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Shown and referenced by aria-describedby while disabled. */
  reason?: string;
  testId?: string;
};

export type SolutionChromeProps = {
  mode: "review" | "continue";
  draft: SolutionDraft;
  status?: SolutionStatusLine[];
  primary: SolutionPrimary;
  /** null on /store, where the SiteBottomBar dock is the one help option. */
  help?: { seed: string; askLabel?: string } | null;
  suggestion?: ReactNode;
  saveState?: ReactNode;
  nextStepLine?: string;
  /** Bump to pulse the count once (an add). */
  pulseKey?: number;
  /** Extra content for the rail body (review mode): e.g. an empty-state line. */
  emptyText?: string;
  onEditProfile?: () => void;
  /**
   * The bar's compact action below 1024. Magenta when the bar carries the
   * page's one forward action (/store, the workspace); secondary when the
   * page has its own in-flow primary (the family page), so one magenta shows.
   */
  compactVariant?: "primary" | "secondary";
  /** Review mode hides the bar while the draft is empty on /store; the family page keeps it (it carries the primary). */
  mountWhenEmpty?: boolean;
  /** The bar's short action word beside the status; the sheet carries the full primary label. Must say what the tap does. */
  compactLabel?: string;
};

const STEP_LABEL: Record<StoreStepId, string> = Object.fromEntries(STORE_STEPS.map((step) => [step.id, step.label])) as Record<
  StoreStepId,
  string
>;

function countLine(draft: SolutionDraft): string {
  const n = draft.needs.length;
  const needs = n === 1 ? "1 need" : `${n} needs`;
  return isProfileComplete(draft.environment) ? `${needs} · sized` : `${needs} · not sized yet`;
}

function StatusList({ status, onNavigate }: { status: SolutionStatusLine[]; onNavigate?: () => void }) {
  return (
    <ul className="d2-status" data-testid="solution-status">
      {status.map((line) => (
        <li key={line.id} className="d2-status__line" data-state={line.state}>
          <span className="d2-status__mark" aria-hidden="true">
            ✓
          </span>
          <span className="d2-status__text">
            <span className="d2-label d2-ink-soft mr-2">{STEP_LABEL[line.id]}</span>
            {line.state === "gap" && line.href ? (
              <a href={line.href} onClick={onNavigate}>
                {line.text}
              </a>
            ) : (
              line.text
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The needs as a list with Remove; a remove is announced and undoable in place, and never closes the sheet. */
function NeedsList({ draft }: { draft: SolutionDraft }) {
  const { announce } = useAnnouncer();
  const [undo, setUndo] = useState<{ familyId: CuratedSolutionFamily["id"]; label: string; source?: string } | null>(null);
  const undoStillValid = undo && !draft.needs.some((need) => need.familyId === undo.familyId);
  if (draft.needs.length === 0 && !undoStillValid) return null;
  return (
    <>
      <ul className="d2-rows mt-3" data-testid="solution-needs">
        {draft.needs.map((need) => {
          const family = getFamilyById(need.familyId);
          if (!family) return null;
          return (
            <li key={need.familyId} className="flex items-start justify-between gap-3 d2-small">
              <span className="min-w-0">{family.label}</span>
              <button
                type="button"
                className="d2-action d2-action--quiet"
                onClick={() => {
                  const before = readSolutionDraft().needs.find((entry) => entry.familyId === need.familyId);
                  removeDraftNeed(need.familyId);
                  setUndo({ familyId: need.familyId, label: family.label, source: before?.source });
                  announce(`${family.label} removed from Your Solution`);
                }}
                aria-label={`Remove ${family.label}`}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      {undoStillValid ? (
        <UndoRow
          text={`${undo.label} removed from Your Solution`}
          onUndo={() => {
            addDraftNeed(undo.source ? { familyId: undo.familyId, source: undo.source } : { familyId: undo.familyId });
            announce(`${undo.label} added back to Your Solution`);
            setUndo(null);
          }}
          testId="chrome-undo"
        />
      ) : null}
    </>
  );
}

function Primary({ primary, onNavigate }: { primary: SolutionPrimary; onNavigate?: () => void }) {
  return (
    <StoreAction
      variant="primary"
      block
      href={primary.href}
      onClick={() => {
        primary.onClick?.();
        onNavigate?.();
      }}
      disabled={primary.disabled}
      reason={primary.reason}
      testId={primary.testId ?? "solution-primary"}
    >
      {primary.label}
    </StoreAction>
  );
}

function ChromeBody({
  props,
  onNavigate,
  inSheet = false,
}: {
  props: SolutionChromeProps;
  onNavigate?: () => void;
  inSheet?: boolean;
}) {
  const { draft, status, mode, suggestion, saveState, nextStepLine, emptyText, onEditProfile } = props;
  const empty = draft.needs.length === 0;
  return (
    <>
      {onEditProfile || inSheet ? (
        <div className="mt-3">
          <ProfileLine environment={draft.environment} onEdit={() => { onEditProfile?.(); onNavigate?.(); }} editLabel="Edit" testId="chrome-profile-line" />
        </div>
      ) : null}
      {mode === "continue" && status ? <StatusList status={status} onNavigate={onNavigate} /> : null}
      {mode === "review" ? (
        <>
          {empty ? (
            <p className="d2-small d2-ink mt-3" data-testid="solution-empty">
              {emptyText ?? "Nothing added yet. Start from a situation or add a need."}
            </p>
          ) : null}
          <NeedsList draft={draft} />
        </>
      ) : null}
      {suggestion ? <div className="mt-3">{suggestion}</div> : null}
      {nextStepLine ? <p className="d2-small d2-ink-soft mt-3">{nextStepLine}</p> : null}
      {saveState ? <div className="mt-3">{saveState}</div> : null}
    </>
  );
}

/** ≥ 1024: the sticky panel beside the content. The only raised container on the index and family pages. */
export function SolutionRail(props: SolutionChromeProps) {
  const wide = useMinWidth(1024);
  if (!wide) return null;
  return (
    <aside className="d2-rail" aria-label="Your Solution" data-testid="solution-rail">
      <div className="d2-rail__count">
        <p className="d2-h3">Your Solution</p>
        <p className="d2-mono d2-accent-ink" data-testid="solution-count">
          {countLine(props.draft)}
        </p>
      </div>
      <ChromeBody props={props} />
      <div className="mt-5">
        <Primary primary={props.primary} />
      </div>
      {props.help ? <HelpRow seed={props.help.seed} askLabel={props.help.askLabel} className="mt-4" /> : null}
    </aside>
  );
}

/** < 1024: the Store's one fixed element, and its bottom sheet. */
export function SolutionBar(props: SolutionChromeProps) {
  const wide = useMinWidth(1024);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const empty = props.draft.needs.length === 0;
  const mounted = !wide && !(props.mode === "review" && empty && !props.mountWhenEmpty);

  useDockHiddenWhileOpen(open && mounted);

  // Publish the bar's height and mark the document so the canvas reserves the
  // space (store-builder.css, html[data-de-store-bar]); nothing ever scrolls
  // beneath the bar, so it never fades. Both reset on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    if (!mounted || !el) {
      root.style.setProperty("--de-store-cart-h", "0px");
      delete root.dataset.deStoreBar;
      return undefined;
    }
    root.dataset.deStoreBar = "true";
    const publish = () => root.style.setProperty("--de-store-cart-h", `${Math.round(el.offsetHeight) + 12}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--de-store-cart-h", "0px");
      delete root.dataset.deStoreBar;
    };
  }, [mounted]);

  useEffect(() => {
    if (!props.pulseKey) return undefined;
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 220);
    return () => window.clearTimeout(timer);
  }, [props.pulseKey]);

  if (!mounted) return null;

  const gap = props.status?.find((line) => line.state === "gap");
  const statusText = props.mode === "continue" ? (gap ? gap.text : "Ready") : countLine(props.draft);
  const close = () => setOpen(false);

  return (
    <>
      <div
        ref={barRef}
        className="d2-bar de-fixed-in-canvas"
        role="region"
        aria-label="Your Solution"
        data-testid="solution-bar"
        style={{
          bottom: "calc(var(--de-chrome-inset) + var(--de-cookie-h, 0px) + var(--de-unified-bar-h, 0px))",
          left: "calc(var(--de-canvas-gutter) + var(--de-chrome-inset))",
          right: "calc(var(--de-canvas-gutter) + var(--de-chrome-inset))",
        }}
      >
        <button type="button" className="d2-bar__status" onClick={() => setOpen(true)} aria-expanded={open} data-testid="solution-bar-open">
          <span className="d2-label">
            <Layers className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
            Your Solution
            <span className="d2-bar__count ml-1 inline-block" data-d2-pulse={pulse ? "true" : undefined}>
              · {props.draft.needs.length}
            </span>
          </span>
          <strong>{statusText}</strong>
        </button>
        {props.mode === "continue" && props.primary.disabled ? (
          <button type="button" className="d2-action d2-action--secondary d2-action--sm" onClick={() => setOpen(true)} aria-label="Open Your Solution">
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <StoreAction
            variant={props.compactVariant ?? "primary"}
            size="sm"
            href={props.primary.href}
            onClick={props.primary.onClick}
            ariaLabel={props.primary.label}
            testId="solution-bar-primary"
          >
            {props.compactLabel ?? (props.mode === "continue" ? "Continue" : "Review")}
          </StoreAction>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="d2-sheet-panel de-store-jelly-sheet border-0" data-testid="your-solution-sheet">
          <div className="d2-sheet-panel__scroll">
            <SheetHeader className="pt-5 text-left">
              <SheetTitle className="d2-h3 text-white">Your Solution</SheetTitle>
              <SheetDescription className="d2-small d2-ink-soft">{countLine(props.draft)}</SheetDescription>
            </SheetHeader>
            <ChromeBody props={props} onNavigate={close} inSheet />
          </div>
          <div className="d2-sheet-panel__foot">
            <Primary primary={props.primary} onNavigate={close} />
            {props.help ? (
              <HelpRow seed={props.help.seed} askLabel={props.help.askLabel} onBeforeAsk={close} />
            ) : (
              <Link href={SOLUTION_WORKSPACE_PATH} className="d2-action d2-action--quiet" onClick={close}>
                Open Your Solution
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
