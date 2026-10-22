// Dex's shape data: the bars, the poses for every emotion, and the holiday glyphs. No CSS and no React here,
// so the same numbers drive the site component, the plain-SVG renderer used in email and Desk, and the JSON
// kit that other apps read. Drawn from the DE logo mark (viewBox 0 0 44 56.5, bar height 9.5, gold #E3B23C).

export const MARK_BARS = [
  { x: 0, y: 0, w: 44 },
  { x: 6.5, y: 15.67, w: 31 },
  { x: 6.5, y: 31.33, w: 31 },
  { x: 0, y: 47, w: 44 },
] as const;
export const BAR_H = 9.5;

/** The whole mark's viewBox. Holiday glyphs sit inside its top-right corner. */
export const DEX_VIEWBOX = "-6 -6 56 68.5";

export type DexState = "idle" | "listening" | "thinking" | "speaking";

export type DexMode = "normal" | "alert" | "curious" | "focused" | "extreme" | "reassuring" | "concerned" | "done" | "resting";

export interface DexPose {
  label: string;
  note: string;
  /** Eye height multiplier. */
  eyeRy: number;
  /** Eye vertical shift, viewBox units, negative is up. */
  eyeDy: number;
  /** Each eye's distance from the centre line (x = 22). */
  eyeSpread: number;
  /** Sideways shift per bar, viewBox units, bar 0 at the top. */
  barX: readonly [number, number, number, number];
}

/** A fixed pose per mode. Numbers only, so the motion can tween between them. */
export const DEX_MODES: Record<DexMode, DexPose> = {
  normal: { label: "Normal", note: "Level bars, eyes open. The resting pose.", eyeRy: 1, eyeDy: 0, eyeSpread: 5, barX: [0, 0, 0, 0] },
  alert: { label: "Alert", note: "Eyes wide and raised. Something needs attention.", eyeRy: 1.3, eyeDy: -0.6, eyeSpread: 5, barX: [0, 0, 0, 0] },
  curious: { label: "Curious", note: "Eyes look up and apart; the bars tilt a touch.", eyeRy: 1.05, eyeDy: -1.2, eyeSpread: 5.6, barX: [-1, 0, 0, 1] },
  focused: { label: "Focused", note: "Narrowed eyes looking down. Working through a ticket.", eyeRy: 0.72, eyeDy: 0.7, eyeSpread: 4.6, barX: [0, 0, 0, 0] },
  extreme: { label: "Extreme", note: "Hard alert: eyes wide, bars jolted apart. Reserved for incidents.", eyeRy: 1.45, eyeDy: -0.4, eyeSpread: 6, barX: [-1.6, 1.6, -1.6, 1.6] },
  reassuring: { label: "Reassuring", note: "Soft, level eyes. Someone is taking it from here.", eyeRy: 0.9, eyeDy: 0.4, eyeSpread: 5, barX: [0, 0, 0, 0] },
  concerned: { label: "Concerned", note: "Eyes lowered and a little narrow. Something did not go to plan.", eyeRy: 0.85, eyeDy: 0.5, eyeSpread: 4.8, barX: [0, 0, 0, 0] },
  done: { label: "Done", note: "Eyes squint into a content line. Only once the outcome is confirmed.", eyeRy: 0.3, eyeDy: 0, eyeSpread: 5, barX: [0, 0, 0, 0] },
  resting: { label: "Resting", note: "Eyes closed to a line. Outside working hours, or paused.", eyeRy: 0.08, eyeDy: 0, eyeSpread: 5, barX: [0, 0, 0, 0] },
};

export const EYE_BASE_Y = 36.08;
export const EYE_CENTRE_X = 22;
export const EYE_RX = 1.9;
export const EYE_RY = 2.1;

/** Left and right eye positions and heights for a pose. */
export function eyePoses(pose: DexPose) {
  return [
    { x: EYE_CENTRE_X - pose.eyeSpread, y: EYE_BASE_Y + pose.eyeDy, sy: pose.eyeRy },
    { x: EYE_CENTRE_X + pose.eyeSpread, y: EYE_BASE_Y + pose.eyeDy, sy: pose.eyeRy },
  ] as const;
}

/** Holiday glyphs: small shapes in the mark's top-right corner. Paths are centred on 0,0 at about 10 units wide. */
export type GlyphId = "star" | "heart" | "leaf" | "sun" | "moon" | "snowflake" | "clover";

export interface GlyphShape {
  /** "fill" draws a solid shape; "stroke" draws lines. */
  paint: "fill" | "stroke";
  d: string;
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;

function starPath(outer = 5, inner = 2.2): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

export const GLYPHS: Record<GlyphId, GlyphShape> = {
  star: { paint: "fill", d: starPath() },
  heart: { paint: "fill", d: "M0 3.4 C-5.2 -0.4 -3.2 -4.6 0 -1.7 C3.2 -4.6 5.2 -0.4 0 3.4 Z" },
  leaf: { paint: "fill", d: "M0 -5 C4 -2 4 3 0 5 C-4 3 -4 -2 0 -5 Z" },
  sun: { paint: "stroke", d: `${circle(0, 0, 2.2)} M0 -3.6 L0 -5.2 M0 3.6 L0 5.2 M-3.6 0 L-5.2 0 M3.6 0 L5.2 0 M-2.5 -2.5 L-3.7 -3.7 M2.5 2.5 L3.7 3.7 M-2.5 2.5 L-3.7 3.7 M2.5 -2.5 L3.7 -3.7` },
  moon: { paint: "fill", d: "M1 -5 A5 5 0 1 0 5 1 A4 4 0 1 1 1 -5 Z" },
  snowflake: { paint: "stroke", d: "M0 -5 L0 5 M-4.33 -2.5 L4.33 2.5 M-4.33 2.5 L4.33 -2.5" },
  clover: { paint: "fill", d: `${circle(-2.2, -1.8, 2.4)} ${circle(2.2, -1.8, 2.4)} ${circle(0, 2.2, 2.4)}` },
};

/** Where a holiday glyph sits: centre in viewBox units and scale. Same for every glyph. */
export const GLYPH_TRANSFORM = "translate(43 -0.5) scale(1.05)";
