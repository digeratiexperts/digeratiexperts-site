// Card objects (Exploration, 2026-10-19): one monochrome 3D object per card, in document order,
// placed by section without editing the live section components. Objects are ILLUSTRATIVE kie.ai renders
// (abstract, no faces, no text). Decorative: aria-hidden, empty alt.
import { useEffect, type RefObject } from "react";

type Placement = { selector: string; objects: string[]; size?: number };

const BASE = "/concepts/objects/obj-";

// Keyed by chapter id. Objects are matched to cards in order; a card past the list gets none.
export const objectPlan: Record<string, Placement[]> = {
  hero: [{ selector: ".v8s-02 .claims > *", objects: ["shield", "people", "chart"], size: 120 }],
  challenges: [{ selector: ".problems > .problem", objects: ["lock", "backup", "clipboard", "email", "bell", "eye"], size: 150 }],
  services: [{ selector: ".svc-paths .svc-path", objects: ["server", "people", "clipboard"], size: 150 }],
  protection: [{ selector: ".steps > .step", objects: ["clipboard", "map", "toolbox", "gear"], size: 120 }],
  testimonials: [{ selector: ".proof-cells > li", objects: ["network", "eye", "headset"], size: 120 }],
  trust: [{ selector: ".why__pillars > li", objects: ["building", "people", "chart", "document"], size: 110 }],
  pricing: [{ selector: ".pricing-grid .pricing-card", objects: ["laptop", "network", "shield", "building"], size: 120 }],
};

export function useCardObjects(rootRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const placed: HTMLElement[] = [];
    for (const [chapter, placements] of Object.entries(objectPlan)) {
      const section = root.querySelector<HTMLElement>(`#${chapter}`);
      if (!section) continue;
      for (const p of placements) {
        const cards = section.querySelectorAll<HTMLElement>(p.selector);
        cards.forEach((card, i) => {
          const name = p.objects[i];
          if (!name || card.querySelector(".hc-obj")) return;
          const img = document.createElement("img");
          img.src = `${BASE}${name}.webp`;
          img.alt = "";
          img.setAttribute("aria-hidden", "true");
          img.loading = "lazy";
          img.decoding = "async";
          img.width = p.size ?? 120;
          img.height = p.size ?? 120;
          img.className = "hc-obj";
          card.classList.add("hc-has-obj");
          card.prepend(img);
          placed.push(img);
        });
      }
    }
    return () => {
      for (const img of placed) {
        img.parentElement?.classList.remove("hc-has-obj");
        img.remove();
      }
    };
  }, [rootRef]);
}
