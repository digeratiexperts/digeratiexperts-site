import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode, TouchEvent as ReactTouchEvent } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A DE Desk session row for touchscreens: swipe right or left to reveal a
 * neon action and release past the line to run it; hold to open the options
 * menu (the touch stand-in for right-click). Mouse and keyboard users keep the
 * right-click menu around it; this only adds the touch layer.
 *
 * Vertical scrolling stays with the browser (touch-action: pan-y): a gesture
 * only becomes a swipe once it is clearly sideways, so the list still scrolls.
 */

export type SwipeTone = "violet" | "magenta" | "emerald";

export type SwipeAction = {
  label: string;
  icon: LucideIcon;
  tone: SwipeTone;
  run: () => void;
};

const TONES: Record<SwipeTone, { rgb: string; text: string; ink: string }> = {
  violet: { rgb: "167, 139, 250", text: "text-[#DDD6FE]", ink: "#C4B5FD" },
  magenta: { rgb: "240, 76, 151", text: "text-[#FFD1E6]", ink: "#F04C97" },
  emerald: { rgb: "52, 211, 153", text: "text-emerald-100", ink: "#6EE7B7" },
};

const LONG_PRESS_MS = 480;
/** Sideways travel before a touch counts as a swipe rather than a tap or scroll. */
const SWIPE_SLOP = 10;
/** Share of the row a swipe must cross to run its action. */
const COMMIT_RATIO = 0.38;
const MAX_COMMIT_PX = 140;

type Props = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  children: ReactNode;
  /** Revealed on the left as the row slides right. */
  swipeRight?: SwipeAction | null;
  /** Revealed on the right as the row slides left. */
  swipeLeft?: SwipeAction | null;
  onLongPress?: (x: number, y: number) => void;
  wrapperClassName?: string;
};

function NeonPanel({
  action,
  side,
  progress,
  armed,
}: {
  action: SwipeAction;
  side: "left" | "right";
  progress: number;
  armed: boolean;
}) {
  const tone = TONES[action.tone];
  const Icon = action.icon;
  const glow = 0.25 + Math.min(progress, 1) * 0.55 + (armed ? 0.2 : 0);
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 flex items-center ${
        side === "left" ? "justify-start pl-5" : "justify-end pr-5"
      } bg-[#07040f]`}
      style={{
        boxShadow: `inset 0 0 ${18 + progress * 26}px rgba(${tone.rgb}, ${glow}), inset 0 0 0 1px rgba(${tone.rgb}, ${0.35 + glow / 2})`,
        background: `linear-gradient(${side === "left" ? "90deg" : "270deg"}, rgba(${tone.rgb}, ${0.18 + progress * 0.22}) 0%, rgba(7, 4, 15, 0.95) 70%)`,
      }}
    >
      <span
        className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] ${tone.text} transition-transform duration-150 motion-reduce:transition-none ${
          armed ? "scale-110" : "scale-100"
        }`}
        style={{
          opacity: 0.45 + Math.min(progress, 1) * 0.55,
          textShadow: `0 0 6px rgba(${tone.rgb}, 0.9), 0 0 ${armed ? 18 : 10}px rgba(${tone.rgb}, 0.7)`,
        }}
      >
        <Icon
          className="h-5 w-5"
          style={{ filter: `drop-shadow(0 0 ${armed ? 10 : 5}px ${tone.ink})`, color: tone.ink }}
        />
        {action.label}
      </span>
    </div>
  );
}

export const SwipeableDeskRow = forwardRef<HTMLButtonElement, Props>(function SwipeableDeskRow(
  {
    children,
    swipeRight,
    swipeLeft,
    onLongPress,
    onClick,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    className = "",
    wrapperClassName = "",
    style,
    ...rest
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({
    startX: 0,
    startY: 0,
    mode: "idle" as "idle" | "pending" | "swipe" | "scroll",
    timer: null as number | null,
    suppressClick: false,
    armed: false,
  });
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);

  const clearTimer = useCallback(() => {
    const g = gesture.current;
    if (g.timer != null) {
      window.clearTimeout(g.timer);
      g.timer = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const width = () => wrapRef.current?.offsetWidth || 320;
  const commitAt = () => Math.min(width() * COMMIT_RATIO, MAX_COMMIT_PX);

  const buzz = (ms: number) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    onTouchStart?.(event);
    const touch = event.touches[0];
    if (!touch || event.touches.length > 1) return;
    const g = gesture.current;
    g.startX = touch.clientX;
    g.startY = touch.clientY;
    g.mode = "pending";
    g.armed = false;
    clearTimer();
    if (onLongPress) {
      const { clientX, clientY } = touch;
      g.timer = window.setTimeout(() => {
        g.timer = null;
        if (g.mode !== "pending") return;
        g.suppressClick = true;
        g.mode = "idle";
        buzz(12);
        onLongPress(clientX, clientY);
      }, LONG_PRESS_MS);
    }
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    onTouchMove?.(event);
    const touch = event.touches[0];
    const g = gesture.current;
    if (!touch || g.mode === "idle" || g.mode === "scroll") return;
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;

    if (g.mode === "pending") {
      if (Math.abs(dy) > SWIPE_SLOP && Math.abs(dy) >= Math.abs(dx)) {
        clearTimer();
        g.mode = "scroll";
        return;
      }
      if (Math.abs(dx) > SWIPE_SLOP && Math.abs(dx) > Math.abs(dy) * 1.2) {
        clearTimer();
        if ((dx > 0 && !swipeRight) || (dx < 0 && !swipeLeft)) {
          g.mode = "scroll";
          return;
        }
        g.mode = "swipe";
        setDragging(true);
      } else {
        return;
      }
    }

    // Only one direction has an action at a time; past the line it resists.
    let next = dx;
    if (next > 0 && !swipeRight) next = 0;
    if (next < 0 && !swipeLeft) next = 0;
    const limit = commitAt();
    const abs = Math.abs(next);
    if (abs > limit) next = Math.sign(next) * (limit + (abs - limit) * 0.35);
    const armed = Math.abs(next) >= limit;
    if (armed !== g.armed) {
      g.armed = armed;
      if (armed) buzz(8);
    }
    setOffset(next);
  };

  const finish = (cancelled: boolean) => {
    clearTimer();
    const g = gesture.current;
    const wasSwipe = g.mode === "swipe";
    g.mode = "idle";
    setDragging(false);
    if (!wasSwipe) {
      setOffset(0);
      return;
    }
    g.suppressClick = true;
    const action = offset > 0 ? swipeRight : swipeLeft;
    if (!cancelled && action && Math.abs(offset) >= commitAt()) {
      const dir = offset > 0 ? "right" : "left";
      setLeaving(dir);
      setOffset(dir === "right" ? width() : -width());
      window.setTimeout(() => {
        setLeaving(null);
        setOffset(0);
        action.run();
      }, 180);
      return;
    }
    setOffset(0);
  };

  const progress = Math.min(Math.abs(offset) / commitAt(), 1.25);
  const armed = Math.abs(offset) >= commitAt();
  const showRight = offset > 0 && swipeRight;
  const showLeft = offset < 0 && swipeLeft;
  const activeTone = showRight ? swipeRight!.tone : showLeft ? swipeLeft!.tone : null;
  const edgeGlow = activeTone
    ? `${offset > 0 ? "-" : ""}6px 0 ${12 + progress * 18}px rgba(${TONES[activeTone].rgb}, ${0.35 + progress * 0.45})`
    : undefined;

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${wrapperClassName}`}>
      {showRight ? <NeonPanel action={swipeRight!} side="left" progress={progress} armed={armed} /> : null}
      {showLeft ? <NeonPanel action={swipeLeft!} side="right" progress={progress} armed={armed} /> : null}
      <button
        ref={ref}
        type="button"
        {...rest}
        onClick={(event) => {
          if (gesture.current.suppressClick) {
            gesture.current.suppressClick = false;
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={(event) => {
          onTouchEnd?.(event);
          finish(false);
        }}
        onTouchCancel={(event) => {
          onTouchCancel?.(event);
          finish(true);
        }}
        className={`relative ${className} ${
          dragging ? "" : "transition-transform duration-200 ease-out motion-reduce:transition-none"
        } ${leaving ? "opacity-0 transition-[transform,opacity]" : ""}`}
        style={{
          ...style,
          touchAction: "pan-y",
          transform: offset ? `translate3d(${offset}px, 0, 0)` : undefined,
          boxShadow: edgeGlow,
        }}
      >
        {children}
      </button>
    </div>
  );
});
