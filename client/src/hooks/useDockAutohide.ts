import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Bottom-bar autohide: "out of the way while you read, back the moment you
 * reach for it". Opt-in (SiteBottomBar `autohide`), so production chrome is
 * unchanged until a page asks for it.
 *
 * Joe, 2026-10-01: "upgrade the bar on the bottom with autohide features that
 * are not annoying." Spec, prototype and behaviour checks:
 * artifacts/design-concepts/homepage-sections-2026-10/bar/.
 *
 * - Tuck after 160px of continuous downward scroll, and only once past the
 *   first viewport (distance counted in the opening screen is discarded).
 * - Come back on 32px of upward scroll, the pointer resting 120ms in the
 *   bottom 96px (fine pointers), keyboard focus entering the bar, or the last
 *   0.6 viewport of the page.
 * - Never tuck while the pointer is over the bar, focus is inside it, for
 *   900ms after a click inside it (chapter jumps and back-to-top scroll the
 *   page; that is navigation, not reading), or in the first 1.2s.
 * - `typing`: below 1024px, while a text field outside the bar has focus,
 *   the bar steps aside for the on-screen keyboard.
 */
export const DOCK_AUTOHIDE = {
  tuck: 160,
  show: 32,
  reach: 96,
  reachDelay: 120,
  jumpHold: 900,
  bootHold: 1200,
} as const;

/** `mounted` re-binds the bar listeners when the bar element mounts or unmounts. */
export function useDockAutohide(enabled: boolean, barRef: RefObject<HTMLElement>, mounted = true) {
  const [tucked, setTucked] = useState(false);
  const [typing, setTyping] = useState(false);
  const tuckedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      tuckedRef.current = false;
      setTucked(false);
      setTyping(false);
      return;
    }
    const T = DOCK_AUTOHIDE;
    let lastY = window.scrollY;
    let acc = 0;
    let dir = 0;
    let holdUntil = performance.now() + T.bootHold;
    let pointerIn = false;
    let focusIn = false;
    let reachTimer = 0;
    let ticking = false;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const desktop = window.matchMedia("(min-width: 1024px)");

    const set = (v: boolean) => {
      if (tuckedRef.current === v) return;
      tuckedRef.current = v;
      setTucked(v);
    };
    const held = () => pointerIn || focusIn || performance.now() < holdUntil;
    const nearEnd = () =>
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - window.innerHeight * 0.6;

    const frame = () => {
      ticking = false;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (dy === 0) return;
      const d = Math.sign(dy);
      if (d !== dir) {
        dir = d;
        acc = 0;
      }
      acc += Math.abs(dy);
      if (y < window.innerHeight) acc = 0;
      if (nearEnd() || y < window.innerHeight) set(false);
      else if (dir > 0 && acc >= T.tuck && !held()) set(true);
      else if (dir < 0 && acc >= T.show) set(false);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer.matches || !tuckedRef.current) return;
      window.clearTimeout(reachTimer);
      if (window.innerHeight - event.clientY <= T.reach) {
        reachTimer = window.setTimeout(() => set(false), T.reachDelay);
      }
    };
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && el.matches("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=true]");
    const onFocusIn = (event: FocusEvent) => {
      const bar = barRef.current;
      if (bar && bar.contains(event.target as Node)) {
        focusIn = true;
        set(false);
        return;
      }
      if (!desktop.matches && isField(event.target)) setTyping(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      const bar = barRef.current;
      if (bar && bar.contains(event.target as Node) && !bar.contains(event.relatedTarget as Node | null)) focusIn = false;
      if (isField(event.target) && !isField(event.relatedTarget)) setTyping(false);
    };

    const bar = barRef.current;
    const onEnter = () => {
      pointerIn = true;
      set(false);
    };
    const onLeave = () => {
      pointerIn = false;
    };
    const onBarClick = () => {
      holdUntil = performance.now() + T.jumpHold;
    };
    bar?.addEventListener("pointerenter", onEnter);
    bar?.addEventListener("pointerleave", onLeave);
    bar?.addEventListener("click", onBarClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.clearTimeout(reachTimer);
      bar?.removeEventListener("pointerenter", onEnter);
      bar?.removeEventListener("pointerleave", onLeave);
      bar?.removeEventListener("click", onBarClick, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [enabled, barRef, mounted]);

  return { tucked, typing };
}
