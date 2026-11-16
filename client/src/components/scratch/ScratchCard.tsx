import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { REVEAL_THRESHOLD, clearedFraction, sampleGridSize } from "@/lib/scratchOffer";

export type ScratchCardHandle = { revealAll: () => void };

type Props = {
  revealed: boolean;
  reducedMotion: boolean;
  onFirstScratch?: () => void;
  onReveal: () => void;
  children: ReactNode;
  label: string;
};

type Point = { x: number; y: number };

const BRUSH_RATIO = 0.085;
const SAMPLE_INTERVAL_MS = 120;

function drawFoil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#f6d77b");
  base.addColorStop(0.22, "#c9952e");
  base.addColorStop(0.45, "#fff1b8");
  base.addColorStop(0.62, "#b98522");
  base.addColorStop(0.82, "#f3cf6b");
  base.addColorStop(1, "#9c6b14");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const tint = ctx.createLinearGradient(0, h, w, 0);
  tint.addColorStop(0, "rgba(211, 18, 106, 0.28)");
  tint.addColorStop(0.5, "rgba(211, 18, 106, 0)");
  tint.addColorStop(1, "rgba(91, 69, 224, 0.26)");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#fff8dc";
  ctx.lineWidth = 1;
  for (let x = -h; x < w; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h * 0.6, h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const grain = ctx.createImageData(Math.ceil(w), Math.ceil(h));
  let seed = 7;
  for (let i = 0; i < grain.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 255;
    grain.data[i] = v;
    grain.data[i + 1] = v * 0.85;
    grain.data[i + 2] = v * 0.4;
    grain.data[i + 3] = 26;
  }
  const grainCanvas = document.createElement("canvas");
  grainCanvas.width = grain.width;
  grainCanvas.height = grain.height;
  grainCanvas.getContext("2d")?.putImageData(grain, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(grainCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  const sheen = ctx.createRadialGradient(w * 0.28, h * 0.2, 0, w * 0.28, h * 0.2, w * 0.7);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.55)");
  sheen.addColorStop(0.35, "rgba(255, 255, 255, 0.12)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const inset = Math.max(6, w * 0.025);
  ctx.setLineDash([2, 5]);
  ctx.strokeStyle = "rgba(92, 58, 6, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.setLineDash([]);

  const size = Math.round(Math.min(w * 0.11, h * 0.2));
  ctx.font = `800 ${size}px "Space Grotesk", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = w / 2;
  const cy = h / 2;
  ctx.letterSpacing = `${Math.round(size * 0.08)}px`;
  ctx.fillStyle = "rgba(255, 250, 225, 0.85)";
  ctx.fillText("SCRATCH HERE", cx + 1.5, cy + 1.5);
  ctx.fillStyle = "rgba(90, 56, 4, 0.75)";
  ctx.fillText("SCRATCH HERE", cx - 1, cy - 1);
  const text = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  text.addColorStop(0, "#b07d1c");
  text.addColorStop(1, "#7a520c");
  ctx.fillStyle = text;
  ctx.fillText("SCRATCH HERE", cx, cy);

  const small = Math.round(size * 0.34);
  ctx.font = `600 ${small}px "Space Grotesk", system-ui, sans-serif`;
  ctx.letterSpacing = `${Math.round(small * 0.2)}px`;
  ctx.fillStyle = "rgba(90, 56, 4, 0.7)";
  ctx.fillText("DIGERATI EXPERTS", cx, cy + size * 0.95);

  ctx.restore();
}

export const ScratchCard = forwardRef<ScratchCardHandle, Props>(function ScratchCard(
  { revealed, reducedMotion, onFirstScratch, onReveal, children, label },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const activeRef = useRef<{ id: number; last: Point; mid: Point } | null>(null);
  const lastSampleRef = useRef(0);
  const doneRef = useRef(revealed);
  const startedRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const [touched, setTouched] = useState(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onReveal();
  }, [onReveal]);

  useImperativeHandle(ref, () => ({ revealAll: finish }), [finish]);

  const strokeSegment = useCallback((ctx: CanvasRenderingContext2D, from: Point, ctrl: Point, to: Point) => {
    const { w } = sizeRef.current;
    ctx.lineWidth = Math.max(26, w * BRUSH_RATIO);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, to.x, to.y);
    ctx.stroke();
  }, []);

  const prepare = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    sizeRef.current = { w: rect.width, h: rect.height, dpr };
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFoil(ctx, rect.width, rect.height);
    prepare(ctx);
    for (const stroke of strokesRef.current) {
      const pts = stroke.map((p) => ({ x: p.x * rect.width, y: p.y * rect.height }));
      if (pts.length === 1) strokeSegment(ctx, pts[0], pts[0], pts[0]);
      for (let i = 1; i < pts.length; i += 1) {
        const prevMid = i === 1 ? pts[0] : { x: (pts[i - 2].x + pts[i - 1].x) / 2, y: (pts[i - 2].y + pts[i - 1].y) / 2 };
        const mid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
        strokeSegment(ctx, prevMid, pts[i - 1], mid);
      }
    }
  }, [prepare, strokeSegment]);

  useEffect(() => {
    if (revealed) return;
    paint();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    });
    observer.observe(wrap);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => !doneRef.current && paint()).catch(() => undefined);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [paint, revealed]);

  const sample = useCallback(
    (force = false) => {
      const now = performance.now();
      if (!force && now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return;
      lastSampleRef.current = now;
      const canvas = canvasRef.current;
      if (!canvas || doneRef.current) return;
      const { cols, rows } = sampleGridSize(canvas.width, canvas.height);
      const probe = sampleRef.current ?? document.createElement("canvas");
      sampleRef.current = probe;
      probe.width = cols;
      probe.height = rows;
      const pctx = probe.getContext("2d", { willReadFrequently: true });
      if (!pctx) return;
      pctx.clearRect(0, 0, cols, rows);
      pctx.drawImage(canvas, 0, 0, cols, rows);
      if (clearedFraction(pctx.getImageData(0, 0, cols, rows).data) >= REVEAL_THRESHOLD) finish();
    },
    [finish],
  );

  const toLocal = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const record = (p: Point) => {
    const { w, h } = sizeRef.current;
    strokesRef.current[strokesRef.current.length - 1]?.push({ x: p.x / w, y: p.y / h });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (doneRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toLocal(e);
    activeRef.current = { id: e.pointerId, last: p, mid: p };
    strokesRef.current.push([]);
    record(p);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      prepare(ctx);
      strokeSegment(ctx, p, p, p);
    }
    if (!startedRef.current) {
      startedRef.current = true;
      setTouched(true);
      onFirstScratch?.();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active || active.id !== e.pointerId || doneRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    prepare(ctx);
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    const points = (events.length ? events : [e.nativeEvent]).map(toLocal);
    for (const p of points) {
      const mid = { x: (active.last.x + p.x) / 2, y: (active.last.y + p.y) / 2 };
      strokeSegment(ctx, active.mid, active.last, mid);
      active.last = p;
      active.mid = mid;
      record(p);
    }
    sample();
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeRef.current?.id !== e.pointerId) return;
    activeRef.current = null;
    sample(true);
  };

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[1.7/1] w-full select-none overflow-hidden rounded-2xl shadow-[0_24px_60px_-20px_rgba(211,18,106,0.55)] ring-1 ring-white/15"
    >
      <div className="absolute inset-0" aria-hidden={!revealed || undefined}>
        {children}
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        aria-hidden={revealed || undefined}
        data-testid="scratch-canvas"
        className={`absolute inset-0 h-full w-full cursor-grab touch-none select-none active:cursor-grabbing ${
          revealed ? "pointer-events-none opacity-0" : "opacity-100"
        } ${reducedMotion ? "" : "transition-opacity duration-500 ease-out"}`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onContextMenu={(e) => e.preventDefault()}
      />
      {!revealed && !touched && !reducedMotion ? (
        <div aria-hidden="true" className="de-scratch-sheen pointer-events-none absolute inset-0" />
      ) : null}
    </div>
  );
});
