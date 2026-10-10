import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PLATE_DIR, STORY, chapterIndex, entrySide, railX, stepNumber, type MotifKey } from "./chapters";
import { Motif } from "./motifs";
import "./story.css";

/*
 * One chapter's background in the Signal Thread (Version 9). Sits where the
 * section's ChapterPattern used to: first child of a positioned, isolated
 * section, z-index -1, so it paints over the section's fill and under its
 * content. Layers, back to front: optional plate, motif, thread.
 *
 * The thread is drawn in the host's own pixels (ResizeObserver), so the node
 * stays round and the rail stays outside the canvas at every width. A magenta
 * copy of the thread draws itself as the chapter scrolls through the viewport;
 * under prefers-reduced-motion it is drawn in full and nothing moves.
 */

const reduceMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// One rAF-throttled scroll loop for every chapter's draw-on progress.
const hosts = new Map<HTMLElement, SVGPathElement>();
let scheduled = false;
let listening = false;
function measure() {
  scheduled = false;
  const vh = window.innerHeight || 1;
  hosts.forEach((path, el) => {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -vh || rect.top > vh * 2) return;
    const p = Math.min(1, Math.max(0, (vh * 0.8 - rect.top) / Math.max(1, rect.height)));
    path.style.strokeDashoffset = (1 - p).toFixed(4);
    el.toggleAttribute("data-st-in", p > 0.02);
  });
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(measure);
}

export function StoryBackdrop({ chapter }: { chapter: MotifKey }): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  const drawRef = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const index = chapterIndex(chapter);
  const story = STORY[index];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    const path = drawRef.current;
    if (!el || !path) return undefined;
    if (reduceMotion()) {
      path.style.strokeDashoffset = "0";
      el.setAttribute("data-st-in", "");
      return undefined;
    }
    hosts.set(el, path);
    if (!listening) {
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      listening = true;
    }
    schedule();
    return () => {
      hosts.delete(el);
      if (hosts.size === 0 && listening) {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        listening = false;
      }
    };
  }, [size]);

  if (!story) return null;
  const isLast = index === STORY.length - 1;
  const number = String(stepNumber(index)).padStart(2, "0");
  const label = `${number} · ${story.label}`;

  let thread: JSX.Element | null = null;
  if (size && size.w > 0 && size.h > 0) {
    const { w, h } = size;
    const narrow = w < 640;
    const x0 = railX(w, entrySide(index));
    const x1 = railX(w, story.side);
    // Cross inside the section's top padding (48px on phones, 64px above).
    const band = narrow ? 26 : 34;
    const nodeY = narrow ? 52 : 72;
    const end = isLast ? Math.min(h, nodeY + (narrow ? 150 : 200)) : h;
    const turn = Math.min(18, Math.abs(x1 - x0) / 2);
    const dir = x1 > x0 ? 1 : -1;
    const d =
      x0 === x1
        ? `M${x0} 0V${end}`
        : `M${x0} 0V${band - turn}Q${x0} ${band} ${x0 + dir * turn} ${band}H${x1 - dir * turn}Q${x1} ${band} ${x1} ${band + turn}V${end}`;
    const labelY = nodeY + 18;
    thread = (
      <svg className="st-thread" width={w} height={h} viewBox={`0 0 ${w} ${h}`} focusable="false">
        <path d={d} className="st-thread__base" />
        <path ref={drawRef} d={d} className="st-thread__draw" pathLength={1} />
        {story.passthrough ? null : (
          <>
        <circle cx={x1} cy={nodeY} r={narrow ? 8 : 10} className="st-node__halo" />
        <circle cx={x1} cy={nodeY} r={narrow ? 3.5 : 4.5} className="st-node" />
        <text
          className="st-label"
          x={x1}
          y={labelY}
          transform={`rotate(90 ${x1} ${labelY})`}
          dominantBaseline="central"
        >
          {label}
        </text>
          </>
        )}
        {isLast ? <circle cx={x1} cy={end} r={narrow ? 3 : 4} className="st-node st-node--end" /> : null}
      </svg>
    );
  }

  return (
    <div
      ref={ref}
      className={`st st--${story.tone} st--${story.side} st--${story.key}`}
      aria-hidden="true"
      data-testid={`story-backdrop-${story.key}`}
    >
      {story.plate ? (
        <img
          className="st-plate"
          src={`${PLATE_DIR}/${story.plate}-1600.webp`}
          srcSet={`${PLATE_DIR}/${story.plate}-960.webp 960w, ${PLATE_DIR}/${story.plate}-1600.webp 1600w`}
          sizes="(min-width: 1024px) 70vw, 100vw"
          alt=""
          width={1600}
          height={900}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <div className="st-motif">
        <Motif motif={story.key} />
      </div>
      {thread}
    </div>
  );
}
