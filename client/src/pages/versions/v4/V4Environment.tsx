import { useMemo } from "react";
import { ease, ramp } from "./useChapterProgress";

/**
 * The V4 environment — one object for chapters 01–03, not three illustrations.
 *
 * Nine parts of a business technology estate. They are all present from the
 * first frame; what changes is whether they are operating as one system. The
 * page never rotates: the residual heading error lives inside this SVG's own
 * coordinate space and resolves there.
 *
 *   phase A (hero)         present, calm, each slightly off true
 *   phase B (disconnected) named, drifting, no connective tissue
 *   phase C (alignment)    headings resolve to true, the system connects
 *
 * Built from DOM/SVG and CSS transforms. No canvas, no WebGL — the lightest
 * technology that delivers it, per the source of truth.
 *
 * Decorative: the meaning is carried by the chapter text, and this is
 * aria-hidden. Nothing here is evidence, so nothing here needs classifying.
 */

type Node = {
  key: string;
  label: string;
  /** Deterministic drift, so the composition is designed rather than random. */
  driftAngle: number;
  driftRadius: number;
  tickOffset: number;
};

const NODES: Node[] = [
  { key: "people", label: "People", driftAngle: -9, driftRadius: 18, tickOffset: 34 },
  { key: "identity", label: "Identity", driftAngle: 6, driftRadius: -22, tickOffset: -28 },
  { key: "endpoints", label: "Endpoints", driftAngle: -13, driftRadius: 11, tickOffset: 47 },
  { key: "email", label: "Email", driftAngle: 11, driftRadius: 25, tickOffset: -19 },
  { key: "cloud", label: "Cloud", driftAngle: -5, driftRadius: -16, tickOffset: 38 },
  { key: "network", label: "Network", driftAngle: 14, driftRadius: 9, tickOffset: -44 },
  { key: "applications", label: "Applications", driftAngle: -11, driftRadius: -25, tickOffset: 22 },
  { key: "data", label: "Data", driftAngle: 8, driftRadius: 20, tickOffset: -36 },
  { key: "vendors", label: "Vendors", driftAngle: -7, driftRadius: -12, tickOffset: 41 },
];

const CENTER = 240;
const RADIUS = 168;

/** The residual heading error, in degrees. 348° is 12° short of true. */
export const HEADING_ERROR_DEG = -12;

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + Math.cos(rad) * radius, y: CENTER + Math.sin(rad) * radius };
}

/**
 * Chords drawn once the estate is one system. Ring neighbours plus a few
 * crossings, so it reads as connected rather than merely circular.
 */
const CHORDS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0],
  [0, 4], [1, 6], [2, 7], [3, 8], [5, 0],
];

export function V4Environment({
  progress,
  reduced,
  labelled = true,
}: {
  /** 0 → 1 across chapters 01–03. */
  progress: number;
  /** When true the environment renders resolved and static. */
  reduced: boolean;
  labelled?: boolean;
}) {
  const p = reduced ? 1 : progress;

  const state = useMemo(() => {
    // Disorder holds through the hero and the disconnected chapter, then
    // resolves across the alignment chapter. It never returns.
    const resolve = ease(ramp(p, 0.6, 0.98));
    const disorder = 1 - resolve;

    // Labels belong to the disconnected chapter onward: the hero should feel
    // subtly wrong without naming why.
    const labelOpacity = labelled ? ease(ramp(p, 0.3, 0.46)) : 0;

    // The system connects only as the headings come true.
    const link = ease(ramp(p, 0.68, 1));

    return {
      resolve,
      disorder,
      labelOpacity,
      link,
      headingDeg: HEADING_ERROR_DEG * disorder,
      glow: 0.1 + 0.16 * resolve,
    };
  }, [p, labelled]);

  return (
    <svg
      viewBox="0 0 480 480"
      className="w-full h-full block"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      data-testid="v4-environment"
      data-resolved={state.resolve > 0.99 ? "true" : "false"}
    >
      <defs>
        {/* Violet is lighting only — never a panel fill. */}
        <radialGradient id="v4-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={state.glow} />
          <stop offset="70%" stopColor="#5B45E0" stopOpacity={state.glow * 0.35} />
          <stop offset="100%" stopColor="#5B45E0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={210} fill="url(#v4-glow)" />

      {/* The whole estate carries the residual error and resolves it here,
          inside the SVG. The document is never rotated. */}
      <g transform={`rotate(${state.headingDeg} ${CENTER} ${CENTER})`}>
        {/* True-north reference. Present throughout; it is the estate that
            moves to meet it, not the reference that moves. */}
        <line
          x1={CENTER}
          y1={CENTER - RADIUS - 34}
          x2={CENTER}
          y2={CENTER - RADIUS + 6}
          stroke={state.resolve > 0.985 ? "#D3126A" : "rgba(255,255,255,0.22)"}
          strokeWidth={state.resolve > 0.985 ? 2 : 1}
          strokeLinecap="round"
        />

        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* Connective tissue. Zero-length until the estate is one system, so
            there is never a half-drawn web sitting in a dead range. */}
        <g opacity={state.link}>
          {CHORDS.map(([a, b]) => {
            const na = NODES[a]!;
            const nb = NODES[b]!;
            const pa = polar((a / NODES.length) * 360 + na.driftAngle * state.disorder, RADIUS + na.driftRadius * state.disorder);
            const pb = polar((b / NODES.length) * 360 + nb.driftAngle * state.disorder, RADIUS + nb.driftRadius * state.disorder);
            return (
              <line
                key={`${a}-${b}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1"
              />
            );
          })}
        </g>

        {NODES.map((node, i) => {
          const angle = (i / NODES.length) * 360 + node.driftAngle * state.disorder;
          const radius = RADIUS + node.driftRadius * state.disorder;
          const { x, y } = polar(angle, radius);
          // Each part points its own way while the estate is disconnected, and
          // to true once it is not.
          const tick = node.tickOffset * state.disorder;
          return (
            <g key={node.key}>
              <g transform={`rotate(${angle + tick} ${x} ${y})`}>
                <line
                  x1={x}
                  y1={y - 13}
                  x2={x}
                  y2={y - 5}
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </g>
              <circle
                cx={x}
                cy={y}
                r={4.5}
                fill={state.resolve > 0.985 ? "#F7F5F2" : "rgba(247,245,242,0.62)"}
              />
              {state.labelOpacity > 0.01 && (
                <text
                  x={x}
                  y={y + 22}
                  textAnchor="middle"
                  opacity={state.labelOpacity}
                  className="fill-white/55"
                  style={{
                    fontFamily: "Oxanium, 'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                  }}
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
