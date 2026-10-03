import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkoutPaneSummary,
  coveragePaneSummary,
  defaultSolutionDrawerPanes,
  itemsPaneSummary,
  openItemsPane,
  readSolutionDrawerViewport,
  toggleSolutionPane,
} from "./solutionDrawerPanes";

describe("solution drawer panes", () => {
  it("uses stacked, two-pane, then three-pane viewports", () => {
    expect(readSolutionDrawerViewport(390)).toBe("mobile");
    expect(readSolutionDrawerViewport(767)).toBe("mobile");
    expect(readSolutionDrawerViewport(768)).toBe("tablet");
    expect(readSolutionDrawerViewport(1023)).toBe("tablet");
    expect(readSolutionDrawerViewport(1024)).toBe("desktop");
    expect(readSolutionDrawerViewport(1440)).toBe("desktop");
  });

  it("keeps items and checkout open; coverage only defaults open on desktop", () => {
    expect(defaultSolutionDrawerPanes("mobile")).toEqual({
      items: true,
      coverage: false,
      checkout: true,
    });
    expect(defaultSolutionDrawerPanes("tablet")).toEqual({
      items: true,
      coverage: false,
      checkout: true,
    });
    expect(defaultSolutionDrawerPanes("desktop")).toEqual({
      items: true,
      coverage: true,
      checkout: true,
    });
  });

  it("reopens items after add without closing checkout", () => {
    const collapsedItems = { items: false, coverage: true, checkout: true };
    expect(openItemsPane(collapsedItems)).toEqual({
      items: true,
      coverage: true,
      checkout: true,
    });
  });

  it("toggles panes independently", () => {
    const start = defaultSolutionDrawerPanes("desktop");
    const coverageClosed = toggleSolutionPane(start, "coverage");
    expect(coverageClosed.coverage).toBe(false);
    expect(coverageClosed.items).toBe(true);
    expect(coverageClosed.checkout).toBe(true);
  });

  it("summarizes existing solution data without inventing totals", () => {
    expect(itemsPaneSummary(1)).toBe("1 service");
    expect(itemsPaneSummary(4)).toBe("4 services");
    expect(coveragePaneSummary(3, 6)).toBe("3 of 6 areas");
    expect(checkoutPaneSummary({ dueToday: 2599, monthly: 224, annual: 0 })).toMatch(
      /^Due today \$2,?599\.00$/,
    );
    expect(checkoutPaneSummary({ dueToday: 0, monthly: 224, annual: 0 })).toMatch(/^Monthly \$224\.00$/);
    expect(checkoutPaneSummary({ dueToday: 0, monthly: 0, annual: 0 })).toBe("Review totals");
  });
});

describe("Your Solution drawer source", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const cartSrc = readFileSync(resolve(dir, "ShoppingCart.tsx"), "utf8");
  const paneSrc = readFileSync(resolve(dir, "SolutionDrawerPane.tsx"), "utf8");

  it("lays out independent panes instead of a single stacked max-w-xl column", () => {
    expect(cartSrc).toMatch(/id="items"/);
    expect(cartSrc).toMatch(/id="coverage"/);
    expect(cartSrc).toMatch(/id="checkout"/);
    expect(cartSrc).toMatch(/lg:max-w-6xl/);
    expect(cartSrc).toMatch(/md:grid-cols-2/);
    expect(cartSrc).toMatch(/lg:grid-cols-\[minmax\(0,1\.35fr\)/);
    expect(cartSrc).toMatch(/data-accent="electric"/);
    expect(paneSrc).toMatch(/data-testid=\{`solution-pane-\$\{id\}`\}/);
    expect(paneSrc).toMatch(/aria-expanded=\{open\}/);
    expect(paneSrc).toMatch(/min-h-11/);
  });

  it("preserves checkout, quote, shopping, and assessment actions", () => {
    expect(cartSrc).toMatch(/Continue to staff checkout/);
    expect(cartSrc).toMatch(/Staff quote \(no charge\)/);
    expect(cartSrc).toMatch(/Continue catalog/);
    expect(cartSrc).toMatch(/button-schedule-from-cart/);
    expect(cartSrc).toMatch(/button-checkout/);
    expect(cartSrc).toMatch(/button-save-quote/);
  });
});
