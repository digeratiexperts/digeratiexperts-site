import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_CONTENT_FALLBACK_ID } from "@/components/SkipToContent";

/**
 * Blog article pages own their own <main> (not PageTemplate). The global
 * skip link's no-JS fallback is href="#main-content", so both the article
 * and not-found shells must expose that id.
 */
describe("BlogPost skip / main landmark", () => {
  const source = readFileSync(
    path.resolve(__dirname, "./BlogPost.tsx"),
    "utf8",
  );

  it(`exposes <main id="${MAIN_CONTENT_FALLBACK_ID}"> on every main shell`, () => {
    const matches = source.match(
      new RegExp(`<main[^>]*\\bid=["']${MAIN_CONTENT_FALLBACK_ID}["']`, "g"),
    );
    expect(matches?.length).toBe(2);
  });

  it("makes each main landmark programmatically focusable", () => {
    const focusableMains = source.match(
      /<main[^>]*\btabIndex=\{-1\}/g,
    );
    expect(focusableMains?.length).toBe(2);
  });
});
