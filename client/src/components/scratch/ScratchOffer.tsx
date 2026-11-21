import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReducedMotion } from "framer-motion";
import {
  AUTO_SHOW_DELAY_MS,
  autoShowDecision,
  isScratchOfferPath,
  readScratchState,
  scratchOfferEnabled,
  scratchPreviewRequest,
  writeScratchState,
  type ScratchState,
} from "@/lib/scratchOffer";

const ScratchOfferModal = lazy(() =>
  import("./ScratchOfferModal").then((m) => ({ default: m.ScratchOfferModal })),
);

const env = import.meta.env as unknown as Record<string, unknown> & { DEV?: boolean };

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function deskOrPopupOpen(): boolean {
  const html = document.documentElement;
  return html.hasAttribute("data-de-desk-open") || !!document.querySelector('[data-testid="overlay-exit-intent"]');
}

export function ScratchOffer() {
  const [location] = useLocation();
  const reducedMotion = !!useReducedMotion();
  const [state, setState] = useState<ScratchState>(() => readScratchState(storage()));
  const [open, setOpen] = useState(false);
  const enabled = scratchOfferEnabled(env);
  const eligible = isScratchOfferPath(location, window.location.hostname);

  const update = useCallback((next: ScratchState) => {
    setState(next);
    writeScratchState(storage(), next);
  }, []);

  useEffect(() => {
    const request = scratchPreviewRequest(window.location.search, env);
    if (!request || !eligible) return;
    const base = request === "reset" ? { step: "scratch" as const } : readScratchState(storage());
    update({ ...base, open: true });
    setOpen(true);
  }, [eligible, update]);

  useEffect(() => {
    if (!enabled || !eligible || open) return;
    const decision = autoShowDecision(readScratchState(storage()), Date.now());
    if (decision === "skip") return;
    const show = () => {
      if (deskOrPopupOpen()) return;
      update({ ...readScratchState(storage()), open: true });
      setOpen(true);
    };
    if (decision === "resume") {
      show();
      return;
    }
    const timer = window.setTimeout(show, AUTO_SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, eligible, open, update]);

  useEffect(() => {
    if (!open) return;
    const onDesk = (event: Event) => {
      if ((event as CustomEvent<{ open?: boolean }>).detail?.open) setOpen(false);
    };
    window.addEventListener("de-desk-open-change", onDesk as EventListener);
    return () => window.removeEventListener("de-desk-open-change", onDesk as EventListener);
  }, [open]);

  const close = useCallback(() => {
    update({ ...state, open: false, dismissedAt: Date.now() });
    setOpen(false);
  }, [state, update]);

  if (!open || !eligible) return null;
  return (
    <Suspense fallback={null}>
      <ScratchOfferModal state={state} onChange={update} onClose={close} reducedMotion={reducedMotion} />
    </Suspense>
  );
}
