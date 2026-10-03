import { useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Copy, MessageCircle, Phone } from "lucide-react";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import { useAnnouncer } from "@/components/AccessibleAnnouncer";

/*
 * The Store's vocabulary (docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §8): V4's
 * hairline-and-space grammar in the electric channel. Three shapes — a
 * chapter, a cell, a tile — and one action. Styles live in
 * client/src/styles/store-builder.css (Store chunk), never in the entry sheet.
 */

export type StoreTone = "graphite" | "paper";

/** Where a numbered step stands in the buyer's journey (the same readiness the JourneyRail shows). */
export type StepState = "complete" | "current" | "pending";

const STEP_STATE_SR: Record<StepState, string> = {
  complete: " · ready",
  current: " · you are here",
  pending: "",
};

/**
 * A numbered step is a station: "03 Relationship" in a round badge, a ✓ once it is ready, and
 * "You are here" on the current step (Joe, 2026-10-01, concept B). An unnumbered eyebrow keeps
 * the hairline rule. The screen-reader form is "Step 3 · Relationship · you are here".
 */
export function StepLabel({
  n,
  srText,
  state,
  children,
  className = "",
}: {
  n?: string;
  srText?: string;
  state?: StepState;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`d2-step d2-label ${className}`} data-step-state={n ? state : undefined}>
      {n ? (
        <span className="d2-step__n" aria-hidden="true">
          {state === "complete" ? <Check className="d2-step__check" aria-hidden="true" /> : n}
        </span>
      ) : (
        <span className="d2-step__rule" aria-hidden="true" />
      )}
      <span aria-hidden={srText ? "true" : undefined}>{children}</span>
      {n && state === "current" ? (
        <span className="d2-step__here" aria-hidden={srText ? "true" : undefined}>
          You are here
        </span>
      ) : null}
      {srText ? (
        <span className="sr-only">
          {srText}
          {state ? STEP_STATE_SR[state] : ""}
        </span>
      ) : null}
    </p>
  );
}

/** A chapter of a Store page: a top rule, a step label, one heading, at most one forward action inside. */
export function StoreChapter({
  id,
  n,
  eyebrow,
  srText,
  heading,
  lede,
  tone = "graphite",
  first = false,
  stepState,
  children,
  className = "",
  testId,
  headingClassName = "d2-h2",
}: {
  id: string;
  n?: string;
  eyebrow?: ReactNode;
  srText?: string;
  heading?: ReactNode;
  lede?: ReactNode;
  tone?: StoreTone;
  first?: boolean;
  /** Done, current or upcoming: the current step's chapter lights up as a card. */
  stepState?: StepState;
  children?: ReactNode;
  className?: string;
  testId?: string;
  headingClassName?: string;
}) {
  const headingId = `${id}-heading`;
  const station = Boolean(eyebrow && n);
  return (
    <section
      id={id}
      aria-labelledby={heading ? headingId : undefined}
      data-testid={testId}
      data-step-state={station ? stepState : undefined}
      className={`d2-chapter${first ? " d2-chapter--first" : ""}${tone === "paper" ? " d2-chapter--paper" : ""}${station ? " d2-chapter--station" : ""} ${className}`}
    >
      {eyebrow ? (
        <StepLabel n={n} srText={srText} state={station ? stepState : undefined}>
          {eyebrow}
        </StepLabel>
      ) : null}
      {heading ? (
        <h2 id={headingId} className={`${headingClassName} d2-measure`}>
          {heading}
        </h2>
      ) : null}
      {lede ? <p className="d2-body d2-ink d2-measure mt-4">{lede}</p> : null}
      {children}
    </section>
  );
}

export function HairGrid({
  cols = 1,
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: {
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol";
} & Record<string, unknown>) {
  return (
    <Tag className={`d2-grid d2-grid--${cols} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** A cell: a top rule, an optional mono label, a title (the cell's only link when `href` is set), a detail line, actions. */
export function GridCell({
  label,
  title,
  href,
  external = false,
  detail,
  children,
  state = "idle",
  as: Tag = "div",
  testId,
  ariaCurrent,
  titleId,
  className = "",
  clampDetail = false,
}: {
  label?: ReactNode;
  title: ReactNode;
  href?: string;
  external?: boolean;
  detail?: ReactNode;
  children?: ReactNode;
  state?: "idle" | "added" | "current";
  as?: "div" | "li" | "article";
  testId?: string;
  ariaCurrent?: "page" | "step";
  titleId?: string;
  className?: string;
  /** Catalog cells keep two lines of detail; the linked page carries the rest. */
  clampDetail?: boolean;
}) {
  const modifier = state === "idle" ? "" : ` d2-cell--${state}`;
  return (
    <Tag className={`d2-cell${modifier} ${className}`} data-testid={testId} data-state={state}>
      {label ? <span className="d2-cell__label d2-label d2-ink-soft">{label}</span> : null}
      <h3 className="d2-cell__title" id={titleId}>
        {href ? (
          external ? (
            <a href={href} aria-current={ariaCurrent}>
              {title}
            </a>
          ) : (
            <Link href={href} aria-current={ariaCurrent}>
              {title}
            </Link>
          )
        ) : (
          <span aria-current={ariaCurrent}>{title}</span>
        )}
      </h3>
      {detail ? <p className={`d2-cell__detail d2-small${clampDetail ? " d2-clamp-2" : ""}`}>{detail}</p> : null}
      {children ? <div className="d2-cell__actions">{children}</div> : null}
    </Tag>
  );
}

type ActionVariant = "primary" | "secondary" | "quiet";

/**
 * The one action shape. Magenta is the screen's single forward action;
 * secondary is electric outline; quiet is text. A disabled action names its
 * reason through `reason` (rendered and referenced by aria-describedby) so
 * nobody meets a dead button without knowing why.
 */
export function StoreAction({
  variant = "secondary",
  href,
  external = false,
  onClick,
  type = "button",
  disabled = false,
  reason,
  testId,
  block = false,
  size,
  children,
  className = "",
  ariaLabel,
  ariaBusy,
  lead = false,
  attention = false,
}: {
  variant?: ActionVariant;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  reason?: string;
  testId?: string;
  block?: boolean;
  size?: "sm";
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  ariaBusy?: boolean;
  /** The next-step action: a trailing arrow that nudges toward it (Joe, 2026-10-03). */
  lead?: boolean;
  /** Play the attention ring (a need was just added). */
  attention?: boolean;
}) {
  const reasonId = useId();
  const classes = `d2-action d2-action--${variant}${block ? " d2-action--block" : ""}${size ? ` d2-action--${size}` : ""} ${className}`;
  const attn = attention && !disabled ? "true" : undefined;
  const content =
    lead && !disabled ? (
      <>
        {children}
        <ArrowRight className="d2-action__arrow h-4 w-4" aria-hidden="true" />
      </>
    ) : (
      children
    );
  if (href && !disabled) {
    if (external) {
      return (
        <a href={href} className={classes} data-testid={testId} aria-label={ariaLabel} onClick={onClick} data-d2-attn={attn}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} data-testid={testId} aria-label={ariaLabel} onClick={onClick} data-d2-attn={attn}>
        {content}
      </Link>
    );
  }
  return (
    <>
      <button
        type={type}
        className={classes}
        onClick={onClick}
        disabled={disabled}
        aria-describedby={disabled && reason ? reasonId : undefined}
        aria-label={ariaLabel}
        aria-busy={ariaBusy}
        data-testid={testId}
        data-d2-attn={attn}
      >
        {content}
      </button>
      {disabled && reason ? (
        <span id={reasonId} className="d2-small d2-ink-soft mt-2 block">
          {reason}
        </span>
      ) : null}
    </>
  );
}

/** One quiet line that answers as the buyer acts. `status` makes it a polite live region. */
export function LiveLine({
  children,
  status = false,
  className = "",
  testId,
}: {
  children: ReactNode;
  status?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <p className={`d2-live d2-small ${className}`} role={status ? "status" : undefined} data-testid={testId}>
      {children}
    </p>
  );
}

/** Exactly one Ask DE control and one call link per Door 2 page. */
export function HelpRow({
  seed,
  askLabel = "Ask DE about this solution",
  className = "",
  onBeforeAsk,
}: {
  seed: string;
  askLabel?: string;
  className?: string;
  /** Inside a modal sheet: close it first so the Desk opens outside a focus trap. */
  onBeforeAsk?: () => void;
}) {
  return (
    <div className={`d2-help ${className}`}>
      <button
        type="button"
        className="d2-action d2-action--quiet"
        onClick={() => {
          onBeforeAsk?.();
          openMspAdvisor({ context: "store", seedMessage: seed, tab: "chat" });
        }}
        data-testid="ask-de-solution"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {askLabel}
      </button>
      <a
        href={PRIMARY_PHONE.telHref}
        className="d2-action d2-action--quiet"
        aria-label={`Call ${PRIMARY_PHONE.display} (${PRIMARY_PHONE.label})`}
        data-testid="call-de"
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
        Call {PRIMARY_PHONE.display}
      </a>
    </div>
  );
}

/** The short reference DE can quote back, with a copy control and the full correlation id in a disclosure. */
export function ReferenceMark({ reference, correlationId }: { reference: string; correlationId?: string }) {
  const [copied, setCopied] = useState(false);
  const { announce } = useAnnouncer();
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      announce("Reference copied");
    } catch {
      setCopied(false);
      announce("The reference could not be copied; it is shown on the page");
    }
  };
  return (
    <div>
      <p className="d2-reference">
        <span className="d2-label d2-ink-soft">Reference</span>
        <span className="d2-reference__code" data-testid="solution-reference">
          {reference}
        </span>
        <button type="button" className="d2-action d2-action--quiet" onClick={copy}>
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
          <span className="sr-only"> reference {reference}</span>
        </button>
      </p>
      <p className="d2-small d2-ink mt-2">Quote this if you call.</p>
      {correlationId ? (
        <details className="mt-2">
          <summary className="d2-micro d2-ink-soft cursor-pointer">Full record id</summary>
          <p className="d2-mono d2-ink-soft mt-1 break-all">{correlationId}</p>
        </details>
      ) : null}
    </div>
  );
}

/** An inline undo that stays for a few seconds and then leaves quietly. */
export function UndoRow({
  text,
  onUndo,
  onExpire,
  ttlMs = 8000,
  testId,
}: {
  text: string;
  onUndo: () => void;
  onExpire?: () => void;
  ttlMs?: number;
  testId?: string;
}) {
  useEffect(() => {
    if (!onExpire) return;
    const timer = window.setTimeout(onExpire, ttlMs);
    return () => window.clearTimeout(timer);
  }, [onExpire, ttlMs]);
  return (
    <div className="d2-undo d2-small" data-testid={testId}>
      <span className="min-w-0">{text}</span>
      <button type="button" className="d2-action d2-action--quiet" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
