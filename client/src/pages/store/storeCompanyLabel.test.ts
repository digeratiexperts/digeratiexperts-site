import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(resolve(__dirname, name), "utf8");

const BARE_ASK_DIGERATI = /\bask Digerati\b(?!\s+(Experts|Journal))/gi;

describe("public store company naming", () => {
  it("does not use bare Digerati in CoManagedStore helper copy", () => {
    const source = read("CoManagedStore.tsx");
    const hits = [...source.matchAll(BARE_ASK_DIGERATI)].map((m) => m[0]);
    expect(hits).toEqual([]);
  });
});
