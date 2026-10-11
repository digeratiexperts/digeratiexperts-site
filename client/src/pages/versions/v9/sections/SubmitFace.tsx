import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Element kit (Joe, 2026-10-02, "all of it"): a submit button that shows
 * sending → sent in place, without changing width. The button keeps its own
 * type, disabled state and test id; this only supplies the face and a live
 * region. Styles: `.v9-submit` in v9-dashboard.css.
 */
export type SubmitPhase = "idle" | "sending" | "sent";

/** `flash()` after a successful submit shows the sent state for `ms`. */
export function useSentFlash(ms = 2600): [boolean, () => void] {
  const [sent, setSent] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = useCallback(() => {
    window.clearTimeout(timer.current);
    setSent(true);
    timer.current = window.setTimeout(() => setSent(false), ms);
  }, [ms]);
  return [sent, flash];
}

export function submitPhase(isSubmitting: boolean, sent: boolean): SubmitPhase {
  return isSubmitting ? "sending" : sent ? "sent" : "idle";
}

export function SubmitFace({
  phase,
  sendingLabel,
  sentLabel,
  children,
}: {
  phase: SubmitPhase;
  sendingLabel: string;
  sentLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <span className="v9-submit__lbl">{children}</span>
      <span className="v9-submit__spin" aria-hidden="true">
        <i />
      </span>
      <span className="v9-submit__done" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="v9-sr" aria-live="polite">
        {phase === "sending" ? sendingLabel : phase === "sent" ? sentLabel : ""}
      </span>
    </>
  );
}

/** Drawn check shown inside a required field once its value is valid. */
export function FieldOk() {
  return (
    <svg className="v9-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
