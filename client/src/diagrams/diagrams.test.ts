import { describe, expect, it } from "vitest";
import { DIAGRAM_IDS, diagramMeta, renderDiagram } from "./diagrams";

describe("DE diagram system", () => {
  it("renders every diagram in both layouts and tones as a classified figure", () => {
    for (const id of DIAGRAM_IDS) {
      for (const layout of ["wide", "narrow"] as const) {
        for (const tone of ["dark", "paper"] as const) {
          const html = renderDiagram(id, { layout, tone, state: 1 });
          expect(html).toMatch(/^<figure class="dg dg--(dark|paper) dg--(wide|narrow)"/);
          expect(html).toContain("<svg viewBox=");
          expect(html).toContain('class="dg-telemetry"');
          expect(html).toContain('role="img"');
        }
      }
    }
  });

  it("keeps marketing diagrams between five and nine nodes", () => {
    for (const id of DIAGRAM_IDS) {
      const meta = diagramMeta(id);
      expect(meta.nodes).toBeGreaterThanOrEqual(4);
      expect(meta.nodes).toBeLessThanOrEqual(9);
    }
  });

  it("classifies anything scenario-shaped and never invents figures", () => {
    expect(diagramMeta("assessment").classification).toBe("EXAMPLE");
    expect(renderDiagram("assessment")).toContain("EXAMPLE");
    for (const id of DIAGRAM_IDS) {
      const html = renderDiagram(id);
      // no percentages, minutes, scores, or dollar figures in any label
      expect(html).not.toMatch(/\d+\s?%/);
      expect(html).not.toMatch(/\b\d+\s?(min|ms|hrs?)\b/i);
      expect(html).not.toMatch(/RISK\s*\/\s*\d+/);
      expect(html).not.toMatch(/\$\d/);
      expect(html).not.toMatch(/LIVE/);
    }
  });

  it("uses the canonical ProActive tier names in order", () => {
    const html = renderDiagram("coverage", { state: 1 });
    const order = ["IT", "Office", "Business", "Enterprise"].map((t) => html.indexOf(`>${t}<`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("maps state to stages and exposes progress for scroll-driven drawing", () => {
    // nine stages: the exposed business, seven blocks, then the continuous layer
    const start = renderDiagram("protection", { state: 0 });
    const mid = renderDiagram("protection", { state: 0.5 });
    const end = renderDiagram("protection", { state: 1 });
    expect(start).toContain('data-dg-stage="0"');
    expect(mid).toMatch(/data-dg-stage="4"/);
    expect(end).toContain('data-dg-stage="8"');
    expect(mid).toMatch(/--dg-p:0\.5/);
  });

  it("draws the eight cybersecurity blocks with Risk & Exposure as the continuous layer", () => {
    for (const layout of ["wide", "narrow"] as const) {
      const html = renderDiagram("protection", { layout, state: 1 });
      expect(html.match(/class="dg-layer(?: dg-layer--band)?"/g)).toHaveLength(8);
      expect(html).toContain('class="dg-layer dg-layer--band" data-dg-at="8"');
      expect(html).toContain("RISK &amp; EXPOSURE");
      expect(html).toContain("runs continuously beneath all seven");
      expect(html).not.toMatch(/SECURITY OPERATIONS|BACKUP/);
    }
    // a page may pass its own layers; anything outside 4..8 falls back
    const custom = renderDiagram("protection", { data: { layers: [{ code: "01", label: "One", answers: "x" }] } });
    expect(custom).toContain("IDENTITY &amp; ACCESS");
  });

  it("draws hairlines, not glow: no filters, gradients, or neon fills in the markup", () => {
    for (const id of DIAGRAM_IDS) {
      const html = renderDiagram(id);
      expect(html).not.toMatch(/<filter|feGaussianBlur|Gradient/);
    }
  });
});
