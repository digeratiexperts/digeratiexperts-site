/**
 * The bottom launcher (Ask DE, back-to-top, homepage chapter menu) steps aside
 * while the visitor is scrolling and returns when the page settles, so a fixed
 * pill never sits on top of copy that is moving past.
 *
 * Asked for in chat 2026-11-20 ("hide the launcher while scrolling"). Separate
 * from the opt-in `autohide` in useDockAutohide (Joe, 2026-10-01), which tucks
 * only the chapter dock and back-to-top and keeps the Ask DE button on screen.
 *
 * It must never hide something the visitor is using, so scrolling does not hide
 * it while the pointer is over it, keyboard focus is inside it, or the Desk is
 * open. The CSS side repeats the focus rule with :not(:focus-within), because a
 * `visibility: hidden` element drops out of the tab order and a keyboard user
 * who scrolls with Space or the arrow keys would otherwise lose their place.
 */

/** Attribute on <html> while a scroll is in progress. Read by index.css. */
export const LAUNCHER_SCROLLING_ATTR = "deLauncherScrolling";

/** How long the page must be still before the launcher comes back. */
export const LAUNCHER_SCROLL_IDLE_MS = 700;

/** Ignore scroll movement smaller than this (layout shifts, momentum tails). */
export const LAUNCHER_SCROLL_MIN_DELTA_PX = 6;

export interface LauncherAttention {
  /** The pointer is resting on the launcher. */
  pointerInside: boolean;
  /** Keyboard focus is inside the launcher. */
  focusInside: boolean;
  /** The Desk or its chooser is open. */
  deskOpen: boolean;
}

/** True when scrolling must leave the launcher alone. */
export function launcherHoldsAttention(input: LauncherAttention): boolean {
  return input.pointerInside || input.focusInside || input.deskOpen;
}

/** True when a scroll of this size counts as the visitor scrolling. */
export function isRealScroll(deltaPx: number): boolean {
  return Math.abs(deltaPx) >= LAUNCHER_SCROLL_MIN_DELTA_PX;
}
