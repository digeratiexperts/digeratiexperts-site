import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGELOG, COMPONENTS, TOKEN_GROUPS } from "./registry";
import manifest from "./manifest.generated.json";

const ROOT = resolve(__dirname, "../../..");

describe("design-system registry", () => {
  it("registers unique ids whose files exist", () => {
    const ids = COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COMPONENTS) expect(existsSync(resolve(ROOT, c.file)), c.file).toBe(true);
  });

  it("gives every component do, don't and accessibility guidance", () => {
    for (const c of COMPONENTS) {
      expect(c.dos.length, c.id).toBeGreaterThan(0);
      expect(c.donts.length, c.id).toBeGreaterThan(0);
      expect(c.accessibility.length, c.id).toBeGreaterThan(0);
    }
  });

  it("keeps the changelog newest first", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("generated manifest resolves every token and matches the registry (run npm run design-system:build if this fails)", () => {
    expect(manifest.components.map((c) => c.id)).toEqual(COMPONENTS.map((c) => c.id));
    const names = manifest.tokenGroups.flatMap((g) => g.tokens);
    expect(names.length).toBe(TOKEN_GROUPS.flatMap((g) => g.names).length);
    for (const t of names) expect(t.value, t.name).not.toBeNull();
  });
});
