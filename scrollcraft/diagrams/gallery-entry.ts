/* Gallery entry: renders every diagram at every state for review. Built by
   build-gallery.mjs into lab/ (ignored). Not a site page. */
import { DIAGRAM_IDS, diagramMeta, renderDiagram, setDiagramState } from "../../client/src/diagrams/diagrams";

const root = document.getElementById("gallery")!;
const tone = (new URLSearchParams(location.search).get("tone") as "dark" | "paper") || "dark";
document.documentElement.dataset.tone = tone;

for (const id of DIAGRAM_IDS) {
  const meta = diagramMeta(id);
  const section = document.createElement("section");
  section.className = "g-section";
  section.innerHTML =
    `<header class="g-head"><h2>${meta.title}</h2><p class="g-meta">${meta.classification.replace("_", " ")} · ${meta.nodes} nodes · ${meta.stages.length} stages</p></header>` +
    `<div class="g-row"><div class="g-wide"></div><div class="g-narrow"></div></div>` +
    `<label class="g-state"><span>state</span><input type="range" min="0" max="1" step="0.01" value="1"><output>${meta.stages[meta.stages.length - 1]}</output></label>` +
    `<div class="g-stages"></div>`;
  root.appendChild(section);

  const wide = section.querySelector(".g-wide")!;
  const narrow = section.querySelector(".g-narrow")!;
  wide.innerHTML = renderDiagram(id, { layout: "wide", tone, id: `w-${id}` });
  narrow.innerHTML = renderDiagram(id, { layout: "narrow", tone, id: `n-${id}` });

  const range = section.querySelector<HTMLInputElement>("input")!;
  const out = section.querySelector("output")!;
  range.addEventListener("input", () => {
    const v = Number(range.value);
    for (const fig of section.querySelectorAll<HTMLElement>("figure.dg")) setDiagramState(fig, v);
    const st = Number(section.querySelector("figure.dg")!.getAttribute("data-dg-stage"));
    out.textContent = meta.stages[st];
  });

  // every stage, static, at wide layout: the review strip
  const strip = section.querySelector(".g-stages")!;
  meta.stages.forEach((name, i) => {
    const state = meta.stages.length === 1 ? 1 : (i + 1) / meta.stages.length - 0.001;
    const cell = document.createElement("div");
    cell.className = "g-cell";
    cell.innerHTML = `<p class="g-cellname">${i} · ${name}</p>` + renderDiagram(id, { layout: "wide", tone, state, id: `s-${id}-${i}`, caption: false });
    strip.appendChild(cell);
  });
}
