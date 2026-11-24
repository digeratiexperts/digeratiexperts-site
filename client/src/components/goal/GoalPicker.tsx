import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useReducedMotion } from "framer-motion";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import {
  GOAL_MIN_DELAY_MS,
  GOAL_SCROLL_THRESHOLD,
  clearDeskGoal,
  goalPickerEnabled,
  goalPreviewRequest,
  isGoalPickerPath,
  scrollProgress,
  writeDeskGoal,
  type GoalPick,
} from "@/lib/goalPicker";
import {
  canAutoShowGoalPicker,
  claimSitePopup,
  clearSitePopup,
  markExitIntentShown,
  otherPromoOpen,
} from "@/lib/sitePopup";

const GoalPickerModal = lazy(() =>
  import("./GoalPickerModal").then((m) => ({ default: m.GoalPickerModal })),
);

const env = import.meta.env as unknown as Record<string, unknown> & { DEV?: boolean };

function localStore(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function setDocumentCookie(value: string) {
  try {
    document.cookie = value;
  } catch {
    /* cookie blocked */
  }
}

export function GoalPicker() {
  const [location] = useLocation();
  const reducedMotion = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const enabled = goalPickerEnabled(env);
  const eligible = isGoalPickerPath(location, window.location.hostname);

  const show = useCallback(() => {
    if (!eligible || otherPromoOpen(document)) return false;
    if (!claimSitePopup("goal", localStore(), Date.now(), document.cookie, setDocumentCookie)) return false;
    markExitIntentShown(sessionStore());
    setOpen(true);
    return true;
  }, [eligible]);

  useEffect(() => {
    const request = goalPreviewRequest(window.location.search, env);
    if (!request || !eligible) return;
    if (request === "reset") {
      clearSitePopup(localStore(), setDocumentCookie);
      clearDeskGoal(localStore());
    }
    show();
  }, [eligible, show]);

  useEffect(() => {
    if (!enabled || !eligible || open) return;
    if (!canAutoShowGoalPicker({
      storage: localStore(),
      session: sessionStore(),
      cookieHeader: document.cookie,
      document,
    })) return;

    let armed = false;
    let shown = false;
    const tryShow = () => {
      if (shown || !armed) return;
      shown = show();
    };

    const arm = window.setTimeout(() => {
      armed = true;
      const el = document.documentElement;
      if (scrollProgress(el.scrollTop, el.scrollHeight, el.clientHeight) >= GOAL_SCROLL_THRESHOLD) {
        tryShow();
      }
    }, GOAL_MIN_DELAY_MS);

    const onScroll = () => {
      const el = document.documentElement;
      if (scrollProgress(el.scrollTop, el.scrollHeight, el.clientHeight) >= GOAL_SCROLL_THRESHOLD) {
        tryShow();
      }
    };

    const leavingTowardChrome = (event: MouseEvent) => {
      if (event.clientY > 8) return;
      tryShow();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", leavingTowardChrome);

    return () => {
      window.clearTimeout(arm);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("mouseleave", leavingTowardChrome);
    };
  }, [enabled, eligible, open, show]);

  useEffect(() => {
    if (!open) return;
    const onDesk = (event: Event) => {
      if ((event as CustomEvent<{ open?: boolean }>).detail?.open) setOpen(false);
    };
    window.addEventListener("de-desk-open-change", onDesk as EventListener);
    return () => window.removeEventListener("de-desk-open-change", onDesk as EventListener);
  }, [open]);

  const close = useCallback(() => {
    claimSitePopup("goal", localStore(), Date.now(), document.cookie, setDocumentCookie);
    setOpen(false);
  }, []);

  const pick = useCallback((goal: GoalPick) => {
    writeDeskGoal(localStore(), { id: goal.id, label: goal.label });
    claimSitePopup("goal", localStore(), Date.now(), document.cookie, setDocumentCookie);
    setOpen(false);
    openMspAdvisor({ seedMessage: goal.seedMessage, tab: "chat" });
  }, []);

  if (!open || !eligible) return null;
  return (
    <Suspense fallback={null}>
      <GoalPickerModal onClose={close} onPick={pick} reducedMotion={reducedMotion} />
    </Suspense>
  );
}
