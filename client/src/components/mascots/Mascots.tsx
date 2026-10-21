// Dex and Rati, the Digerati Experts AI employees (Joe, 2026-10-21). Dex is public, Rati works
// behind the scenes. Both are drawn from the exact geometry of the DE logo mark (the four bars the
// homepage pronunciation row draws: viewBox 0 0 44 56.5, bar height 9.5, gold #E3B23C), so the
// shape never drifts the way generated images did. Decorative unless a title is passed.
// Motion lives in mascots.css and stops under prefers-reduced-motion.
import "./mascots.css";

export const MARK_BARS = [
  { x: 0, y: 0, w: 44 },
  { x: 6.5, y: 15.67, w: 31 },
  { x: 6.5, y: 31.33, w: 31 },
  { x: 0, y: 47, w: 44 },
] as const;
const BAR_H = 9.5;

export type DexState = "idle" | "listening" | "thinking" | "speaking";

export type DexMode = "normal" | "alert" | "curious" | "focused" | "extreme";

/**
 * Dex's modes: a fixed pose per mode, held as numbers so the coming animation can tween between them.
 * eyeRy scales eye height, eyeDy moves both eyes (negative is up), eyeSpread is each eye's distance from
 * centre (22), barX shifts each bar sideways in viewBox units (bar 0 is the top).
 */
export const DEX_MODES: Record<
  DexMode,
  { label: string; note: string; eyeRy: number; eyeDy: number; eyeSpread: number; barX: readonly [number, number, number, number] }
> = {
  normal: { label: "Normal", note: "Level bars, eyes open. The resting pose.", eyeRy: 1, eyeDy: 0, eyeSpread: 5, barX: [0, 0, 0, 0] },
  alert: { label: "Alert", note: "Eyes wide and raised. Something needs attention.", eyeRy: 1.3, eyeDy: -0.6, eyeSpread: 5, barX: [0, 0, 0, 0] },
  curious: { label: "Curious", note: "Eyes look up and apart; the bars tilt a touch.", eyeRy: 1.05, eyeDy: -1.2, eyeSpread: 5.6, barX: [-1, 0, 0, 1] },
  focused: { label: "Focused", note: "Narrowed eyes looking down. Working through a ticket.", eyeRy: 0.72, eyeDy: 0.7, eyeSpread: 4.6, barX: [0, 0, 0, 0] },
  extreme: { label: "Extreme", note: "Hard alert: eyes wide, bars jolted apart. Reserved for incidents.", eyeRy: 1.45, eyeDy: -0.4, eyeSpread: 6, barX: [-1.6, 1.6, -1.6, 1.6] },
};

type Common = { size?: number; title?: string; className?: string };

function a11y(title?: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
}

/** Dex, full form: the four gold bars with two eyes in the third bar. */
export function DexMark({
  size = 96,
  title,
  className = "",
  state = "idle",
  mode = "normal",
}: Common & { state?: DexState; mode?: DexMode }): JSX.Element {
  const pose = DEX_MODES[mode];
  return (
    <svg
      viewBox="-6 -6 56 68.5"
      width={size}
      height={(size * 68.5) / 56}
      className={`mascot dex-mark is-${state} ${className}`}
      {...a11y(title)}
    >
      <defs>
        <linearGradient id="dex-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6D27A" />
          <stop offset=".45" stopColor="#E3B23C" />
          <stop offset="1" stopColor="#B9862A" />
        </linearGradient>
      </defs>
      <g className="dex-mark__bars" fill="url(#dex-gold)">
        {/* The mode shift sits on a wrapper <g>, so the CSS state animation on each rect is left alone. */}
        {MARK_BARS.map((b, i) => (
          <g key={b.y} transform={`translate(${pose.barX[i]} 0)`}>
            <rect className={`dex-mark__bar b${i}`} x={b.x} y={b.y} width={b.w} height={BAR_H} rx={BAR_H / 2} />
          </g>
        ))}
      </g>
      {/* Highlights: one soft line along the top of each bar, the "glaze". */}
      <g fill="#fff" opacity=".35">
        {MARK_BARS.map((b, i) => (
          <g key={b.y} transform={`translate(${pose.barX[i]} 0)`}>
            <rect className={`dex-mark__bar b${i}`} x={b.x + 3} y={b.y + 1.3} width={b.w - 6} height={1.6} rx={0.8} />
          </g>
        ))}
      </g>
      <g className="dex-mark__eyes" fill="#121212">
        <ellipse className="dex-eye" cx={22 - pose.eyeSpread} cy={36.08 + pose.eyeDy} rx={1.9} ry={2.1 * pose.eyeRy} />
        <ellipse className="dex-eye" cx={22 + pose.eyeSpread} cy={36.08 + pose.eyeDy} rx={1.9} ry={2.1 * pose.eyeRy} />
      </g>
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
