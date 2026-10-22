// Dex and Rati, the Digerati Experts AI employees (Joe, 2026-10-21). Dex is public, Rati works
// behind the scenes. Both are drawn from the exact geometry of the DE logo mark (the four bars the
// homepage pronunciation row draws: viewBox 0 0 44 56.5, bar height 9.5, gold #E3B23C), so the
// shape never drifts the way generated images did. Decorative unless a title is passed.
// Shape data lives in dexGeometry.ts; motion lives in mascots.css and stops under prefers-reduced-motion.
import "./mascots.css";
import {
  BAR_H,
  DEX_MODES,
  DEX_VIEWBOX,
  EYE_RX,
  EYE_RY,
  GLYPHS,
  GLYPH_TRANSFORM,
  MARK_BARS,
  eyePoses,
  type DexMode,
  type DexState,
} from "./dexGeometry";
import type { Holiday } from "./holidays";

export { DEX_MODES, MARK_BARS, type DexMode, type DexState } from "./dexGeometry";

type Common = { size?: number; title?: string; className?: string };

function a11y(title?: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
}

/**
 * Dex, full form: the four gold bars with two eyes in the third bar. Changing `mode` tweens the bars and
 * eyes to the new pose (CSS transition, off under reduced motion). `holiday` adds that day's glyph.
 */
export function DexMark({
  size = 96,
  title,
  className = "",
  state = "idle",
  mode = "normal",
  holiday = null,
}: Common & { state?: DexState; mode?: DexMode; holiday?: Holiday | null }): JSX.Element {
  const pose = DEX_MODES[mode];
  const glyph = holiday ? GLYPHS[holiday.glyph] : null;
  return (
    <svg
      viewBox={DEX_VIEWBOX}
      width={size}
      height={(size * 68.5) / 56}
      className={`mascot dex-mark is-${state} ${className}`}
      data-mode={mode}
      data-holiday={holiday?.id}
      {...a11y(title)}
    >
      <defs>
        <linearGradient id="dex-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6D27A" />
          <stop offset=".45" stopColor="#E3B23C" />
          <stop offset="1" stopColor="#B9862A" />
        </linearGradient>
      </defs>
      {/* Each mode shift sits on a wrapper <g>, so the CSS state animation on each rect is left alone. */}
      <g className="dex-mark__bars" fill="url(#dex-gold)">
        {MARK_BARS.map((b, i) => (
          <g key={b.y} className="dex-mark__tween" style={{ transform: `translate(${pose.barX[i]}px, 0px)` }}>
            <rect className={`dex-mark__bar b${i}`} x={b.x} y={b.y} width={b.w} height={BAR_H} rx={BAR_H / 2} />
          </g>
        ))}
      </g>
      {/* Highlights: one soft line along the top of each bar, the "glaze". */}
      <g fill="#fff" opacity=".35">
        {MARK_BARS.map((b, i) => (
          <g key={b.y} className="dex-mark__tween" style={{ transform: `translate(${pose.barX[i]}px, 0px)` }}>
            <rect className={`dex-mark__bar b${i}`} x={b.x + 3} y={b.y + 1.3} width={b.w - 6} height={1.6} rx={0.8} />
          </g>
        ))}
      </g>
      <g className="dex-mark__eyes" fill="#121212">
        {eyePoses(pose).map((e, i) => (
          <g key={i} className="dex-mark__tween" style={{ transform: `translate(${e.x}px, ${e.y}px) scale(1, ${e.sy})` }}>
            <ellipse className="dex-eye" cx={0} cy={0} rx={EYE_RX} ry={EYE_RY} />
          </g>
        ))}
      </g>
      {holiday && glyph && (
        <g className="dex-mark__holiday" transform={GLYPH_TRANSFORM} aria-hidden="true">
          <path
            d={glyph.d}
            fill={glyph.paint === "fill" ? holiday.accent : "none"}
            stroke={glyph.paint === "stroke" ? holiday.accent : undefined}
            strokeWidth={glyph.paint === "stroke" ? 1.1 : undefined}
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}

/** Rati: the same four bars drawn as magenta blueprint outlines, measuring ticks and a scanning dot. No face. */
export function RatiMark({ size = 96, title, className = "" }: Common): JSX.Element {
  return (
    <svg viewBox="-8 -6 60 68.5" width={size} height={(size * 68.5) / 60} className={`mascot rati-mark ${className}`} {...a11y(title)}>
      <g fill="rgba(211,18,106,0.06)" stroke="#D3126A" strokeWidth="1.1">
        {MARK_BARS.map((b) => (
          <rect key={b.y} x={b.x} y={b.y} width={b.w} height={BAR_H} rx={BAR_H / 2} />
        ))}
      </g>
      {/* Ticks along the top of each bar, every 2 units, a longer one every 10. */}
      <g stroke="#a1a1a6" strokeWidth=".3">
        {MARK_BARS.flatMap((b) =>
          Array.from({ length: Math.floor((b.w - 8) / 2) + 1 }, (_, k) => {
            const x = b.x + 4 + k * 2;
            const long = k % 5 === 0;
            return <line key={`${b.y}-${k}`} x1={x} y1={b.y + 1.6} x2={x} y2={b.y + (long ? 3.4 : 2.5)} />;
          }),
        )}
      </g>
      {/* Height gauge at the left. */}
      <g stroke="#a1a1a6" strokeWidth=".4">
        <line x1="-4.5" y1="0" x2="-4.5" y2="56.5" />
        <line x1="-6" y1="0" x2="-3" y2="0" />
        <line x1="-6" y1="56.5" x2="-3" y2="56.5" />
      </g>
      <circle className="rati-mark__scan" cx="22" cy="4.75" r="1.5" fill="#FF4D8D" />
    </svg>
  );
}
