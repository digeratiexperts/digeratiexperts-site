import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnouncementArt, PortalAnnouncement } from "@shared/portalAnnouncements";

/**
 * Self-Service announcement carousel: one large slide with its neighbours
 * peeking at the edges, a headline, a line of copy and one button, after the
 * intranet news hero Joe referenced. Autoplays every 7s, pauses on hover,
 * focus, the pause button, or when reduced motion is requested (then it never
 * autoplays). Swipe, arrow buttons, arrow keys and dots move it. Slide art is
 * drawn in code (ILLUSTRATIVE), no photography.
 */

const INTERVAL_MS = 7000;

const ART_TONE: Record<AnnouncementArt, { from: string; to: string; ink: string }> = {
  security: { from: "#2a0d05", to: "#7a2a0c", ink: "#ff9a5c" },
  calendar: { from: "#1c1a22", to: "#4a4452", ink: "#e9e4f0" },
  loaner: { from: "#0b0915", to: "#3b1230", ink: "#f45ea3" },
  return: { from: "#0b0915", to: "#24154a", ink: "#a78bfa" },
  status: { from: "#06140f", to: "#0f3b2c", ink: "#34d399" },
  general: { from: "#0b0915", to: "#2a1a3d", ink: "#f45ea3" },
};

function SlideArt({ art }: { art: AnnouncementArt }) {
  const t = ART_TONE[art];
  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${t.from}, ${t.to})` }} aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 360" preserveAspectRatio="xMidYMid slice" fill="none">
        <g stroke={t.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
          {art === "security" && (
            <>
              <path d="M40 300h120v-80h140v-60h160v90h140v-120h160" opacity="0.5" />
              <path d="M90 60h100v70h120M520 40v80h200" opacity="0.5" />
              {[
                [170, 120],
                [430, 210],
                [620, 90],
                [700, 240],
              ].map(([x, y], i) => (
                <g key={i} transform={`translate(${x} ${y})`}>
                  <rect x="-34" y="-30" width="68" height="64" rx="10" />
                  <rect x="-16" y="-4" width="32" height="26" rx="4" />
                  <path d="M-10 -4v-8a10 10 0 0 1 20 0v8" />
                </g>
              ))}
            </>
          )}
          {art === "calendar" && (
            <g transform="translate(360 40) rotate(-14)">
              <rect width="360" height="280" rx="12" />
              {Array.from({ length: 5 }).map((_, r) =>
                Array.from({ length: 7 }).map((__, c) => <rect key={`${r}-${c}`} x={16 + c * 48} y={40 + r * 46} width="40" height="38" rx="4" opacity="0.6" />),
              )}
            </g>
          )}
          {art === "loaner" && (
            <>
              <rect x="420" y="70" width="240" height="160" rx="10" />
              <path d="M380 260h320l-24 20H404z" />
              <path d="M470 130l26-26h40l-2 36-38 38z" />
              <circle cx="700" cy="110" r="34" />
              <path d="M700 92v36M682 110h36" />
            </>
          )}
          {art === "return" && (
            <>
              <rect x="480" y="70" width="220" height="150" rx="10" />
              <path d="M540 250h100M520 275h140" />
              <path d="M330 200a90 90 0 0 1 150-80" />
              <path d="M480 80v44h-44" />
              <path d="M490 260a90 90 0 0 1-150 10" />
            </>
          )}
          {art === "status" && (
            <>
              <path d="M40 220h160l30-90 40 170 40-120 30 40h460" />
              <circle cx="620" cy="120" r="44" />
              <path d="M600 120l14 14 28-28" />
            </>
          )}
          {art === "general" && (
            <>
              <circle cx="560" cy="150" r="90" opacity="0.5" />
              <circle cx="660" cy="230" r="50" opacity="0.5" />
            </>
          )}
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
    </div>
  );
}

export function AnnouncementCarousel({ slides }: { slides: PortalAnnouncement[] }) {
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [playing, setPlaying] = useState(!reduced);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const drag = useRef<{ x: number; id: number } | null>(null);

  const go = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);

  useEffect(() => {
    if (!playing || hovering || focused || n < 2) return;
    const t = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [playing, hovering, focused, index, n, go]);

  if (n === 0) return null;

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, id: e.pointerId };
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    drag.current = null;
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
  };

  // Slide width leaves a peek of the neighbours; the track is offset to centre the current slide.
  const W = 88;
  const offset = (100 - W) / 2 - index * W;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Announcements"
      className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div
        className="flex touch-pan-y select-none py-3 transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${offset}%)` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-live={playing && !hovering && !focused ? "off" : "polite"}
      >
        {slides.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${s.title}`}
              aria-hidden={!active}
              className={cn("shrink-0 px-1.5 transition-opacity duration-500 motion-reduce:transition-none", active ? "opacity-100" : "opacity-50")}
              style={{ width: `${W}%` }}
              onClick={() => !active && go(i)}
            >
              <div className="relative h-[280px] overflow-hidden rounded-lg sm:h-[340px] lg:h-[380px]">
                <SlideArt art={s.art} />
                <div className="relative flex h-full flex-col justify-end p-5 text-white sm:p-8">
                  {s.source === "company" && (
                    <span className="mb-2 w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]">
                      From your company
                    </span>
                  )}
                  <h3 className="max-w-2xl font-['Space_Grotesk',sans-serif] text-xl font-semibold leading-snug drop-shadow sm:text-3xl">{s.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90 drop-shadow sm:text-base">{s.body}</p>
                  <Link
                    href={s.ctaHref}
                    tabIndex={active ? 0 : -1}
                    className={cn(!active && "pointer-events-none", "mt-4 inline-flex min-h-[44px] w-fit items-center rounded-md bg-white px-4 text-sm font-semibold text-[#14111c] shadow hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black")}
                  >
                    {s.ctaLabel}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous announcement"
            className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next announcement"
            className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="absolute bottom-6 right-[9%] flex items-center gap-1.5 sm:bottom-8">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause announcements" : "Play announcements"}
              className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to announcement ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className="inline-flex h-8 w-6 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className={cn("block h-2 rounded-full bg-white transition-all", i === index ? "w-5" : "w-2 opacity-60")} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
