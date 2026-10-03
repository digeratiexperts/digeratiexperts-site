/**
 * The DE Desk's two first-visit hints (Joe, 2026-10-02): the Ask DE text box
 * hint ("same with the chat text box field") and the full-screen hint
 * ("animate this so people know to make it full screen").
 *
 * The rules live here, free of React, so they can be tested as behaviour:
 * - the text box hint plays first; the full-screen hint waits for it to settle,
 *   so the two never animate together;
 * - each plays at most once per page load and DESK_HINT_MAX times per browser;
 * - each retires for good once the visitor has done what it points at;
 * - neither plays while a person is live in the chat;
 * - the full-screen hint never starts while there is text in the box.
 *
 * Storage is a per-viewer convenience: if it is blocked or holds garbage, the
 * hints still play, once per page load (the caller's played-this-load guard).
 */

export const DESK_HINT_MAX = 3;
export const DESK_EXPAND_HINT_KEY = "de-desk-expand-hint";
export const DESK_EXPAND_HINT_DELAY_MS = 1200;
export const DESK_EXPAND_HINT_DURATION_MS = 5200;
export const DESK_COMPOSER_HINT_KEY = "de-desk-composer-hint";
export const DESK_COMPOSER_HINT_DELAY_MS = 500;
export const DESK_COMPOSER_HINT_DURATION_MS = 5000;

export type DeskHintState = { used: boolean; shown: number };
type HintStorage = Pick<Storage, "getItem" | "setItem">;

/** window.localStorage, or null where reading it throws (private windows, blocked site data). */
export function deskHintStorage(): HintStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDeskHint(key: string, storage: HintStorage | null = deskHintStorage()): DeskHintState {
  try {
    const raw = storage?.getItem(key) ?? null;
    const parsed = raw ? (JSON.parse(raw) as Partial<DeskHintState> | null) : null;
    const shown = Number(parsed?.shown);
    return { used: parsed?.used === true, shown: Number.isFinite(shown) && shown > 0 ? Math.floor(shown) : 0 };
  } catch {
    return { used: false, shown: 0 };
  }
}

export function writeDeskHint(key: string, state: DeskHintState, storage: HintStorage | null = deskHintStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(state));
  } catch {
    /* blocked storage: the once-per-page-load guard still holds */
  }
}

/** The stored value once the visitor has done what a hint points at. */
export const DESK_HINT_RETIRED: DeskHintState = { used: true, shown: DESK_HINT_MAX };

/** True when the per-browser record still allows a hint to play. */
export function deskHintAllowed(stored: DeskHintState): boolean {
  return !stored.used && stored.shown < DESK_HINT_MAX;
}

/**
 * What the text box hint should do now.
 * - "idle": nothing to do (closed, or it already played this page load);
 * - "settle": it will not play this time, so the full-screen hint may go;
 * - "wait": it may play, but not yet (the greeting is still typing, or the
 *   full-screen hint is on screen);
 * - "play": start it (after DESK_COMPOSER_HINT_DELAY_MS).
 */
export function composerHintDecision(input: {
  isOpen: boolean;
  playedThisLoad: boolean;
  stored: DeskHintState;
  visitorHasSpoken: boolean;
  agentLive: boolean;
  onAskDe: boolean;
  greetingComplete: boolean;
  expandHintShowing: boolean;
}): "idle" | "settle" | "wait" | "play" {
  if (!input.isOpen || input.playedThisLoad) return "idle";
  if (!deskHintAllowed(input.stored) || input.visitorHasSpoken || input.agentLive || !input.onAskDe) return "settle";
  if (!input.greetingComplete || input.expandHintShowing) return "wait";
  return "play";
}

/**
 * Whether the full-screen hint should start now (after
 * DESK_EXPAND_HINT_DELAY_MS): docked, on a screen wide enough to expand, nobody
 * live, the text box hint settled and not showing, and the box empty.
 */
export function expandHintShouldStart(input: {
  isOpen: boolean;
  canExpand: boolean;
  isFullscreen: boolean;
  agentLive: boolean;
  playedThisLoad: boolean;
  composerHintSettled: boolean;
  composerHintShowing: boolean;
  composerHasText: boolean;
  stored: DeskHintState;
}): boolean {
  if (!input.isOpen || !input.canExpand || input.isFullscreen || input.agentLive || input.playedThisLoad) return false;
  if (!input.composerHintSettled || input.composerHintShowing || input.composerHasText) return false;
  return deskHintAllowed(input.stored);
}
