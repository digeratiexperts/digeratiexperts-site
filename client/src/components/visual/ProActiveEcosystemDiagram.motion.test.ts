import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(dir, "ProActiveEcosystemDiagram.tsx"), "utf8");

describe("ProActiveEcosystemDiagram reduced motion", () => {
  it("honors prefers-reduced-motion for stage transitions and the selected pulse", () => {
    expect(src).toMatch(/useReducedMotion/);
    expect(src).toMatch(/prefersReducedMotion \? false : \{ opacity: 0, y: 6 \}/);
    expect(src).toMatch(/prefersReducedMotion \? "" : " animate-pulse"/);
  });
});
