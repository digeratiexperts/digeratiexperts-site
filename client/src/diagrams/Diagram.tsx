import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./diagrams.css";
import { renderDiagram, setDiagramState, type DiagramId, type Layout, type Tone } from "./diagrams";

export interface DiagramProps {
  id: DiagramId;
  /** 0..1 progress through the diagram's stages. Default 1 (complete). */
  state?: number;
  tone?: Tone;
  /** "auto" picks narrow under 560px of container width. */
  layout?: Layout | "auto";
  caption?: boolean;
  /** Node id to emphasise (e.g. from a hovered capability). */
  focus?: string | null;
  className?: string;
  /** Diagram-specific data overrides (see diagrams.ts). */
  data?: Record<string, unknown>;
}

const NARROW_BELOW = 560;

/**
 * Mounts a DE diagram (client/src/diagrams) in React. The SVG is rendered
 * from data as a string; state changes never re-render, they update the
 * figure in place so a scroll-driven page can call it every frame.
 */
export function Diagram({ id, state = 1, tone = "dark", layout = "auto", caption = true, focus = null, className, data }: DiagramProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [resolvedLayout, setResolvedLayout] = useState<Layout>(layout === "auto" ? "wide" : layout);

  useLayoutEffect(() => {
    if (layout !== "auto") {
      setResolvedLayout(layout);
      return;
    }
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => setResolvedLayout(el.clientWidth < NARROW_BELOW ? "narrow" : "wide");
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  const html = renderDiagram(id, { layout: resolvedLayout, tone, state, caption, data });

  useEffect(() => {
    const fig = hostRef.current?.querySelector("figure.dg");
    if (fig) setDiagramState(fig, state);
  }, [state, html]);

  useEffect(() => {
    const fig = hostRef.current?.querySelector("figure.dg");
    if (!fig) return;
    if (focus) fig.setAttribute("data-focus", focus);
    else fig.removeAttribute("data-focus");
  }, [focus, html]);

  return <div ref={hostRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
