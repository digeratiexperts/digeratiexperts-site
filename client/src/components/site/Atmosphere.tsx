import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Site atmosphere (Joe, 2026-10-05: "make a parallax effect on pages upon
 * scroll and make background patterns and artistic things").
 *
 * - One rAF-throttled scroll loop for every parallax layer on the page. Each
 *   layer gets --de-px, its section's distance from the viewport centre
 *   (about -1 above, 0 centred, 1 below), and CSS turns that into a
 *   translate at the layer's own depth. Transform only, passive listener,
 *   layers outside the viewport are skipped, and nothing moves under
 *   prefers-reduced-motion.
 * - HeroArt: the flagship family tiles (electric glass, graphite, white
 *   ceramic, one magenta) drawn as an isometric field on three depths.
 * - ChapterPattern: lattice / contour / dots / orbit backgrounds in the
 *   theme's own inks, faded at the edges so text never sits on them hard.
 * Everything here is decorative: aria-hidden, no pointer events.
 */

const layers = new Set<HTMLElement>();
let scheduled = false;
let listening = false;

function measure() {
  scheduled = false;
  const vh = window.innerHeight || 1;
  layers.forEach((el) => {
    const host = el.parentElement;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    if (rect.bottom < -vh * 0.25 || rect.top > vh * 1.25) return;
    const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
    el.style.setProperty("--de-px", progress.toFixed(4));
  });
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(measure);
}

function useParallax(depth: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || depth === 0) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    layers.add(el);
    if (!listening) {
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      listening = true;
    }
    schedule();
    return () => {
      layers.delete(el);
      if (layers.size === 0 && listening) {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        listening = false;
      }
    };
  }, [depth]);
  return ref;
}

/**
 * An absolutely positioned layer that moves `depth` px per viewport of scroll relative to the page:
 * positive reads as nearer (it outruns the page), negative as farther (it lags). Its parent must be positioned.
 */
export function ParallaxLayer({ depth, className, children }: { depth: number; className?: string; children?: ReactNode }) {
  const ref = useParallax(depth);
  return (
    <div ref={ref} aria-hidden="true" className={cn("de-px-layer", className)} style={{ "--de-depth": `${depth}px` } as CSSProperties}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Hero art: the family tiles as an isometric field                          */
/* ------------------------------------------------------------------------ */

type Finish = "glass" | "graphite" | "ceramic" | "magenta";

const TILE_W = 96;
const TILE_H = 56;
const SLAB = 9;

function rhombus(cx: number, cy: number, w: number, h: number, dy = 0) {
  const r = 7;
  // A rounded rhombus: corners pulled in along each edge by r, joined with quadratic curves.
  const p = [
    [cx, cy - h / 2 + dy],
    [cx + w / 2, cy + dy],
    [cx, cy + h / 2 + dy],
    [cx - w / 2, cy + dy],
  ];
  const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const len = Math.hypot(w / 2, h / 2);
  const t = r / len;
  let d = "";
  for (let i = 0; i < 4; i += 1) {
    const prev = p[(i + 3) % 4];
    const cur = p[i];
    const next = p[(i + 1) % 4];
    const a = lerp(cur, prev, t);
    const b = lerp(cur, next, t);
    d += `${i === 0 ? "M" : "L"}${a[0].toFixed(1)},${a[1].toFixed(1)}Q${cur[0]},${cur[1]} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

/** Grid cells (i, j) with a finish and a lift; anything not listed is an outline only. */
const FILLED: Array<{ i: number; j: number; finish: Finish; lift: number }> = [
  { i: 1, j: 0, finish: "glass", lift: 10 },
  { i: 3, j: 0, finish: "ceramic", lift: 4 },
  { i: 0, j: 1, finish: "graphite", lift: 2 },
  { i: 2, j: 1, finish: "glass", lift: 16 },
  { i: 4, j: 1, finish: "graphite", lift: 6 },
  { i: 1, j: 2, finish: "ceramic", lift: 8 },
  { i: 2, j: 2, finish: "magenta", lift: 22 },
  { i: 3, j: 2, finish: "glass", lift: 12 },
  { i: 0, j: 3, finish: "glass", lift: 6 },
  { i: 2, j: 3, finish: "graphite", lift: 4 },
  { i: 4, j: 3, finish: "ceramic", lift: 10 },
  { i: 1, j: 4, finish: "graphite", lift: 8 },
  { i: 3, j: 4, finish: "glass", lift: 14 },
];

const FINISH_STYLE: Record<Finish, { top: string; side: string; edge: string }> = {
  glass: {
    top: "url(#de-hero-glass)",
    side: "rgb(var(--de-accent-rgb) / 0.55)",
    edge: "rgba(255,255,255,0.55)",
  },
  graphite: { top: "url(#de-hero-graphite)", side: "rgba(0,0,0,0.85)", edge: "rgba(255,255,255,0.16)" },
  ceramic: { top: "url(#de-hero-ceramic)", side: "rgba(180,182,196,0.9)", edge: "rgba(255,255,255,0.9)" },
  magenta: { top: "url(#de-hero-magenta)", side: "color-mix(in srgb, var(--de-magenta) 60%, black)", edge: "rgba(255,255,255,0.6)" },
};

const SIZE = 5;
const VIEW_W = 640;
const VIEW_H = 460;
const ORIGIN_X = VIEW_W / 2;
const ORIGIN_Y = 90;

function cellCentre(i: number, j: number) {
  return { x: ORIGIN_X + ((i - j) * TILE_W) / 2 * 1.18, y: ORIGIN_Y + ((i + j) * TILE_H) / 2 * 1.18 };
}

function HeroDefs() {
  return (
    <defs>
      <linearGradient id="de-hero-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="rgb(var(--de-accent-rgb))" stopOpacity="0.55" />
        <stop offset="0.55" stopColor="rgb(var(--de-accent-rgb))" stopOpacity="0.92" />
        <stop offset="1" stopColor="rgb(var(--de-accent-rgb))" stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id="de-hero-graphite" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3a3a42" />
        <stop offset="1" stopColor="#101015" />
      </linearGradient>
      <linearGradient id="de-hero-ceramic" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d9dae2" />
      </linearGradient>
      <linearGradient id="de-hero-magenta" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--de-magenta-ink)" />
        <stop offset="1" stopColor="var(--de-magenta)" />
      </linearGradient>
      <radialGradient id="de-hero-glow">
        <stop offset="0" stopColor="rgb(var(--de-accent-rgb))" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="rgb(var(--de-accent-rgb))" stopOpacity="0.12" />
        <stop offset="1" stopColor="rgb(var(--de-accent-rgb))" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Slab({ i, j, finish, lift }: { i: number; j: number; finish: Finish; lift: number }) {
  const { x, y } = cellCentre(i, j);
  const s = FINISH_STYLE[finish];
  return (
    <g>
      <path d={rhombus(x, y, TILE_W, TILE_H, -lift + SLAB)} fill={s.side} />
      <path d={rhombus(x, y, TILE_W, TILE_H, -lift)} fill={s.top} stroke={s.edge} strokeWidth="0.8" />
    </g>
  );
}

/** The isometric family-tile field behind an interior hero, on three parallax depths. */
export function HeroArt({ className, quiet = false }: { className?: string; quiet?: boolean }) {
  const outlines: Array<{ i: number; j: number }> = [];
  for (let i = 0; i < SIZE; i += 1) for (let j = 0; j < SIZE; j += 1) outlines.push({ i, j });
  const back = FILLED.filter((_, n) => n % 2 === 1);
  const front = FILLED.filter((_, n) => n % 2 === 0);
  const viewBox = `0 0 ${VIEW_W} ${VIEW_H}`;
  return (
    <div aria-hidden="true" className={cn("de-hero-art", quiet && "de-hero-art--quiet", className)}>
      <ParallaxLayer depth={-40} className="de-hero-art__layer">
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          <HeroDefs />
          <ellipse cx={ORIGIN_X} cy={ORIGIN_Y + 230} rx="300" ry="170" fill="url(#de-hero-glow)" />
          {outlines.map(({ i, j }) => {
            const { x, y } = cellCentre(i, j);
            return <path key={`${i}-${j}`} d={rhombus(x, y, TILE_W, TILE_H)} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />;
          })}
        </svg>
      </ParallaxLayer>
      <ParallaxLayer depth={40} className="de-hero-art__layer">
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          <HeroDefs />
          {back.map((tile) => (
            <Slab key={`${tile.i}-${tile.j}`} {...tile} />
          ))}
        </svg>
      </ParallaxLayer>
      <ParallaxLayer depth={110} className="de-hero-art__layer">
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          <HeroDefs />
          {front.map((tile) => (
            <Slab key={`${tile.i}-${tile.j}`} {...tile} />
          ))}
        </svg>
      </ParallaxLayer>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Chapter patterns                                                          */
/* ------------------------------------------------------------------------ */

export type PatternVariant = "lattice" | "contour" | "dots" | "orbit";

/** Concentric, gently irregular loops: a topographic map of nothing in particular. */
function contourPaths() {
  const paths: string[] = [];
  const cx = 520;
  const cy = 260;
  for (let k = 0; k < 11; k += 1) {
    const base = 40 + k * 34;
    let d = "";
    for (let a = 0; a <= 64; a += 1) {
      const t = (a / 64) * Math.PI * 2;
      const r = base + Math.sin(t * 3 + k * 0.7) * (8 + k * 1.6) + Math.cos(t * 5 - k) * 5;
      const x = cx + Math.cos(t) * r * 1.35;
      const y = cy + Math.sin(t) * r;
      d += `${a === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    paths.push(`${d}Z`);
  }
  return paths;
}
const CONTOURS = contourPaths();

/** A full-bleed decorative background for a chapter, drifting slowly on scroll. */
export function ChapterPattern({ variant, className }: { variant: PatternVariant; className?: string }) {
  if (variant === "contour" || variant === "orbit") {
    return (
      <ParallaxLayer depth={variant === "orbit" ? -70 : -48} className={cn("de-pattern de-pattern--svg", `de-pattern--${variant}`, className)}>
        <svg viewBox="0 0 1040 520" preserveAspectRatio="xMaxYMid slice">
          {variant === "contour"
            ? CONTOURS.map((d, n) => <path key={n} d={d} fill="none" stroke="currentColor" strokeWidth="1" />)
            : [0, 1, 2, 3, 4, 5, 6].map((n) => (
                <circle key={n} cx="1040" cy="0" r={140 + n * 70} fill="none" stroke="currentColor" strokeWidth={n === 3 ? 1.5 : 1} strokeDasharray={n % 2 ? "2 10" : undefined} />
              ))}
        </svg>
      </ParallaxLayer>
    );
  }
  return <ParallaxLayer depth={-36} className={cn("de-pattern de-pattern--mask", `de-pattern--${variant}`, className)} />;
}

/** The default pattern per chapter tone: lattice on the well, contours on the surface, dots on paper. */
export function patternForTone(tone: "well" | "surface" | "paper"): PatternVariant {
  if (tone === "surface") return "contour";
  if (tone === "paper") return "dots";
  return "lattice";
}
