import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A paper chapter inside the default PageTemplate layout rendered its headings
 * white on #f7f5f2 — roughly 1.1:1 — while the JSX said `text-neutral-900`.
 * The cause was specificity, not a typo: `.de-prose-dark h2` is 0,1,1 and a
 * text utility on the element is 0,1,0, so the context won every time. Nothing
 * in the source hints at it, and it only shows up once rendered.
 *
 * Wrapping the context selector in :where() drops it to zero, which keeps white
 * as the default for dark prose while letting an explicit colour on the heading
 * win — what anyone reading the JSX already assumes. This asserts on the
 * stylesheet source, the way marketingFallbackNotFound.test.ts does, because
 * the property being protected is a specificity relationship that no rendered
 * assertion states as plainly.
 */
// Comments are stripped first: this file's own rationale mentions the bare
// selector by name, and an assertion that trips over prose describing the bug
// is worse than no assertion.
const CSS = readFileSync(resolve(__dirname, "../index.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("prose heading colour stays overridable", () => {
  for (const context of ["de-prose-dark", "de-prose-light"] as const) {
    it(`${context} sets heading colour at zero specificity`, () => {
      for (const tag of ["h1", "h2", "h3", "h4"]) {
        expect(
          CSS,
          `${context} ${tag} must be written as :where(.${context}) ${tag}`,
        ).toContain(`:where(.${context}) ${tag}`);
        // The bare descendant form is what caused the bug; it must not come back.
        expect(CSS).not.toMatch(
          new RegExp(`(^|[^)])\\.${context} ${tag}\\b`, "m"),
        );
      }
    });
  }
});
