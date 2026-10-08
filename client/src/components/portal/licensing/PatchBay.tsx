import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

/**
 * A patch bay in the spirit of a rack's back panel: cards are the devices,
 * each source card has a jack, and a cable runs from a jack to whatever it is
 * patched into. Patch by dragging a cable from a jack onto a card (mouse,
 * pen or finger), or without dragging: press a jack to pick the cable up,
 * then press "Patch here" on a card. Esc puts the cable down.
 *
 * Cards mark themselves with data attributes; the bay measures them and draws
 * the cables in one SVG layer behind the cards.
 *   <PatchCard id>      a card cables can start or end on
 *   <PatchJack source>  the handle a cable is pulled from
 *   <PatchTarget id>    makes a card accept a cable (shows "Patch here")
 */

export type PatchTone = "magenta" | "violet" | "emerald" | "amber" | "sky" | "teal" | "indigo";

export const PATCH_TONES: Record<PatchTone, string> = {
  magenta: "#F04C97",
  violet: "#A78BFA",
  emerald: "#34D399",
  amber: "#FBBF24",
  sky: "#38BDF8",
  teal: "#2DD4BF",
  indigo: "#818CF8",
};

// Amber is kept for seats still to order, so no vendor is drawn in it.
const TONE_ORDER: PatchTone[] = ["magenta", "violet", "emerald", "sky", "teal", "indigo"];

/** A stable cable colour per vendor, so one vendor's cables read as one bundle. */
export function toneFor(key: string): PatchTone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TONE_ORDER[h % TONE_ORDER.length];
}

export type PatchCable = {
  id: string;
  from: string;
  to: string;
  tone: PatchTone;
  /** Shown on the cable, e.g. "×3". */
  label?: string;
  /** Seats still to be bought: drawn dashed. */
  dashed?: boolean;
};

type Pick = { source: string; tone: PatchTone; label: string };

type BayState = {
  picked: Pick | null;
  dragging: boolean;
  hoverTarget: string | null;
  canPatch: (source: string, target: string) => boolean;
  pickUp: (pick: Pick) => void;
  putDown: () => void;
  patchTo: (target: string) => void;
  beginDrag: (pick: Pick, event: ReactPointerEvent<HTMLElement>) => void;
};

const BayContext = createContext<BayState | null>(null);

function useBay(): BayState {
  const ctx = useContext(BayContext);
  if (!ctx) throw new Error("Patch bay parts must sit inside <PatchBay>");
  return ctx;
}

type Point = { x: number; y: number };

function cablePath(a: Point, b: Point): { d: string; mid: Point } {
  const dx = b.x - a.x;
  const dist = Math.hypot(dx, b.y - a.y);
  // Cables hang: both handles drop by a sag that grows with the run.
  const sag = Math.min(90, 18 + dist * 0.18);
  const c1 = { x: a.x + Math.max(30, Math.abs(dx) * 0.35), y: a.y + sag };
  const c2 = { x: b.x - Math.max(30, Math.abs(dx) * 0.35), y: b.y + sag };
  const mid = { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 };
  return { d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`, mid };
}

function Cable({ a, b, tone, label, dashed, live }: { a: Point; b: Point; tone: PatchTone; label?: string; dashed?: boolean; live?: boolean }) {
  const color = PATCH_TONES[tone];
  const { d, mid } = cablePath(a, b);
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeOpacity={live ? 0.45 : 0.22} strokeWidth={live ? 10 : 7} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={live ? 3 : 2.25}
        strokeLinecap="round"
        strokeDasharray={dashed ? "7 6" : undefined}
        style={{ filter: `drop-shadow(0 0 ${live ? 6 : 3}px ${color})` }}
      />
      <circle cx={a.x} cy={a.y} r={4.5} fill="#050312" stroke={color} strokeWidth={2} />
      <circle cx={b.x} cy={b.y} r={live ? 6 : 4.5} fill={live ? color : "#050312"} stroke={color} strokeWidth={2} />
      {label ? (
        <g transform={`translate(${mid.x} ${mid.y})`}>
          <rect x={-17} y={-10} width={34} height={20} rx={10} fill="#050312" stroke={color} strokeOpacity={0.7} />
          <text textAnchor="middle" dy="4" fontSize="11" fontWeight={600} fill={color} style={{ fontFamily: "Oxanium, ui-monospace, monospace" }}>
            {label}
          </text>
        </g>
      ) : null}
    </g>
  );
}

export function PatchBay({
  cables,
  canPatch,
  onPatch,
  children,
  className = "",
  layoutKey,
}: {
  cables: PatchCable[];
  canPatch: (source: string, target: string) => boolean;
  onPatch: (source: string, target: string) => void;
  children: ReactNode;
  className?: string;
  /** Changes whenever the cards move (data reloaded, panel opened): re-measure. */
  layoutKey?: unknown;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Map<string, DOMRect>>(new Map());
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });
  const [picked, setPicked] = useState<Pick | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [jackAt, setJackAt] = useState<Point | null>(null);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    setOrigin({ x: box.left, y: box.top });
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-patch-card]").forEach((el) => {
      next.set(el.dataset.patchCard!, el.getBoundingClientRect());
    });
    setRects(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, layoutKey, cables]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const putDown = useCallback(() => {
    setPicked(null);
    setDragging(false);
    setPointer(null);
    setJackAt(null);
    setHoverTarget(null);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") putDown();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, putDown]);

  const patchTo = useCallback(
    (target: string) => {
      if (picked && canPatch(picked.source, target)) onPatch(picked.source, target);
      putDown();
    },
    [picked, canPatch, onPatch, putDown],
  );

  const targetUnder = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const card = el?.closest<HTMLElement>("[data-patch-target]");
    return card?.dataset.patchTarget ?? null;
  };

  const beginDrag = useCallback(
    (pick: Pick, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const jack = event.currentTarget.getBoundingClientRect();
      measure();
      setJackAt({ x: jack.left + jack.width / 2, y: jack.top + jack.height / 2 });
      dragRef.current = { startX: event.clientX, startY: event.clientY, moved: false };
      setPicked(pick);
      setPointer({ x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [measure],
  );

  // Pointer tracking for a drag that started on a jack.
  useEffect(() => {
    if (!picked || !dragRef.current) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
        drag.moved = true;
        setDragging(true);
      }
      if (!drag.moved) return;
      e.preventDefault();
      setPointer({ x: e.clientX, y: e.clientY });
      const t = targetUnder(e.clientX, e.clientY);
      setHoverTarget(t && canPatch(picked.source, t) ? t : null);
      // Keep long lists reachable while carrying a cable.
      const edge = 56;
      if (e.clientY < edge) window.scrollBy(0, -14);
      else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 14);
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag?.moved) {
        // A press without a drag: the cable stays picked up for click-to-patch.
        setPointer(null);
        return;
      }
      const t = targetUnder(e.clientX, e.clientY);
      if (t && canPatch(picked.source, t)) onPatch(picked.source, t);
      putDown();
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", putDown);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", putDown);
    };
  }, [picked, canPatch, onPatch, putDown]);

  // Re-measure as the page scrolls during a drag (cards move under the pointer).
  useEffect(() => {
    if (!dragging) return;
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dragging, measure]);

  const value = useMemo<BayState>(
    () => ({
      picked,
      dragging,
      hoverTarget,
      canPatch,
      pickUp: (pick) => {
        setJackAt(null);
        setPicked(pick);
      },
      putDown,
      patchTo,
      beginDrag,
    }),
    [picked, dragging, hoverTarget, canPatch, putDown, patchTo, beginDrag],
  );

  const local = (p: Point): Point => ({ x: p.x - origin.x, y: p.y - origin.y });
  const out = (id: string): Point | null => {
    const r = rects.get(id);
    return r ? local({ x: r.right - 2, y: r.top + Math.min(r.height / 2, 34) }) : null;
  };
  const inn = (id: string): Point | null => {
    const r = rects.get(id);
    return r ? local({ x: r.left + 2, y: r.top + Math.min(r.height / 2, 34) }) : null;
  };

  return (
    <BayContext.Provider value={value}>
      <div ref={rootRef} className={`relative ${className}`}>
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden>
          {cables.map((c) => {
            const a = out(c.from);
            const b = inn(c.to);
            return a && b ? <Cable key={c.id} a={a} b={b} tone={c.tone} label={c.label} dashed={c.dashed} /> : null;
          })}
        </svg>
        <div className="relative z-10">{children}</div>
        {dragging && picked && jackAt && pointer ? (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" aria-hidden>
            <Cable a={local(jackAt)} b={local(pointer)} tone={picked.tone} live />
          </svg>
        ) : null}
        {picked && !dragging ? (
          <div
            role="status"
            className="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit max-w-full items-center gap-3 rounded-full border px-4 py-2 text-sm text-white shadow-2xl"
            style={{ borderColor: PATCH_TONES[picked.tone], background: "#0b0818", boxShadow: `0 0 24px ${PATCH_TONES[picked.tone]}55` }}
          >
            <span className="min-w-0 truncate">
              Carrying <strong>{picked.label}</strong>. Press “Patch here” on a card.
            </span>
            <button type="button" onClick={putDown} className="min-h-9 shrink-0 rounded-full border border-white/20 px-3 text-xs font-semibold hover:bg-white/10">
              Put down
            </button>
          </div>
        ) : null}
      </div>
    </BayContext.Provider>
  );
}

/** A card cables can start or end on. */
export function PatchCard({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const { hoverTarget } = useBay();
  const hot = hoverTarget === id;
  return (
    <div
      data-patch-card={id}
      className={`relative rounded-xl border bg-[#100c1a] transition-shadow duration-150 motion-reduce:transition-none ${
        hot ? "border-[#F04C97] shadow-[0_0_0_1px_#F04C97,0_0_28px_rgba(240,76,151,0.45)]" : "border-white/10"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** The jack a cable is pulled from. */
export function PatchJack({
  source,
  label,
  tone,
  disabled,
  hint,
  size = "md",
}: {
  source: string;
  label: string;
  tone: PatchTone;
  disabled?: boolean;
  hint?: string;
  size?: "sm" | "md";
}) {
  const { picked, pickUp, putDown, beginDrag } = useBay();
  const color = PATCH_TONES[tone];
  const active = picked?.source === source;
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9 sm:h-11 sm:w-11";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${active ? "Put down" : "Pick up"} a cable for ${label}${hint ? `. ${hint}` : ""}`}
      title={hint || `Drag to patch ${label}`}
      onPointerDown={(e) => {
        if (disabled) return;
        beginDrag({ source, tone, label }, e);
      }}
      onClick={(e) => {
        // Keyboard activation (detail 0) toggles the cable; pointer presses were handled in beginDrag.
        if (e.detail === 0) {
          if (active) putDown();
          else pickUp({ source, tone, label });
        }
      }}
      className={`group relative grid ${dim} shrink-0 touch-none place-items-center rounded-full border-2 bg-[#050312] transition motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? "scale-110" : "hover:scale-105"
      } cursor-grab active:cursor-grabbing`}
      style={{ borderColor: color, boxShadow: active ? `0 0 0 3px ${color}55, 0 0 18px ${color}` : `0 0 10px ${color}55` }}
    >
      <span className="block h-1/3 w-1/3 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} aria-hidden />
    </button>
  );
}

/**
 * Makes the enclosing card accept a cable. While a cable is carried it shows
 * a "Patch here" button over the card (also what a drag drops onto).
 */
export function PatchTarget({ id, name }: { id: string; name: string }) {
  const { picked, canPatch, patchTo, dragging } = useBay();
  if (!picked || !canPatch(picked.source, id)) return null;
  const color = PATCH_TONES[picked.tone];
  return (
    <button
      type="button"
      data-patch-target={id}
      onClick={() => patchTo(id)}
      aria-label={`Patch ${picked.label} to ${name}`}
      className="absolute inset-0 z-20 flex items-center justify-end rounded-xl border-2 border-dashed bg-[#050312]/55 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-[1px]"
      style={{ borderColor: color }}
    >
      {dragging ? null : (
        <span className="rounded-full px-2.5 py-1" style={{ background: `${color}33`, color }}>
          Patch here
        </span>
      )}
    </button>
  );
}
