import { afterEach, describe, expect, it, vi } from "vitest";
import type { LicenseAllocation, LicenseAssignment, LicensePoolItem } from "@shared/licenseBoard";
import type { HubLicensesProjection } from "./integrations/hubLicensesContract";
import {
  diffCompanySeats,
  hubCompanySeats,
  hubOrPortalCompanySeats,
  licenseBoardSource,
  productIdentity,
  shadowCompareCompany,
} from "./licenseBoardHubSource";
import { logger } from "./logger";

const item = (id: string, product: string, kind: "license" | "app" = "license", vendor = "Microsoft"): LicensePoolItem => ({
  id,
  kind,
  vendor,
  product,
  category: kind === "app" ? "Baseline apps" : "Productivity",
  catalogKey: null,
  sku: null,
  chocoPackage: kind === "app" ? "googlechrome" : null,
  quantity: kind === "app" ? 0 : 10,
  createdAt: "2026-11-01T00:00:00.000Z",
});

const BP = item("i-bp", "Microsoft 365 Business Premium");
const DEF = item("i-def", "Defender for Business");
const CHROME = item("i-chrome", "Google Chrome", "app", "Google");
const ITEMS = [BP, DEF, CHROME];
const APPS = new Set(["i-chrome"]);

let seq = 0;
const alloc = (itemId: string, source: "pool" | "order", clientId = "c1"): LicenseAllocation => ({
  id: `a${++seq}`,
  itemId,
  clientId,
  source,
  createdAt: "2026-11-02T00:00:00.000Z",
});
const assign = (itemId: string, targetId: string): LicenseAssignment => ({
  id: `s${++seq}`,
  clientId: "c1",
  itemId,
  targetType: "user",
  targetId,
  targetLabel: targetId,
  viaDepartmentId: null,
  createdAt: "2026-11-02T00:00:00.000Z",
});

const hubItem = (productId: number, src: LicensePoolItem, fromPool: number, toOrder: number) => ({
  productId,
  kind: src.kind,
  vendor: src.vendor,
  product: src.product,
  category: src.category,
  catalogKey: src.catalogKey,
  sku: src.sku,
  chocoPackage: src.chocoPackage,
  seats: { total: fromPool + toOrder, fromPool, toOrder },
});
const hub = (items: ReturnType<typeof hubItem>[], accountId = 41): HubLicensesProjection => ({
  contract: "de.hub.licenses/v1",
  accountId,
  generatedAt: "2026-11-05T16:00:00.000Z",
  items,
  totals: {
    products: items.length,
    seats: items.reduce((n, i) => n + i.seats.total, 0),
    fromPool: items.reduce((n, i) => n + i.seats.fromPool, 0),
    toOrder: items.reduce((n, i) => n + i.seats.toOrder, 0),
  },
});

afterEach(() => vi.restoreAllMocks());

describe("LICENSE_BOARD_SOURCE", () => {
  it("defaults to portal, so shipping this changes nothing", () => {
    expect(licenseBoardSource(undefined)).toBe("portal");
    expect(licenseBoardSource("")).toBe("portal");
  });
  it("reads the three positions, case-insensitive", () => {
    expect(licenseBoardSource("portal")).toBe("portal");
    expect(licenseBoardSource(" Shadow ")).toBe("shadow");
    expect(licenseBoardSource("HUB")).toBe("hub");
  });
  it("reads anything else as portal (fails safe)", () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(licenseBoardSource("hubb")).toBe("portal");
    expect(licenseBoardSource("true")).toBe("portal");
  });
});

describe("product matching", () => {
  it("matches on kind + vendor + product, ignoring case and spacing", () => {
    expect(productIdentity({ kind: "license", vendor: " microsoft ", product: "Microsoft  365 business premium" })).toBe(productIdentity(BP));
    expect(productIdentity({ kind: "app", vendor: BP.vendor, product: BP.product })).not.toBe(productIdentity(BP));
  });
});

describe("diffCompanySeats (shadow)", () => {
  it("is empty when the Hub holds the same seats per product", () => {
    const allocations = [alloc("i-bp", "pool"), alloc("i-bp", "pool"), alloc("i-bp", "order"), alloc("i-chrome", "pool"), alloc("i-bp", "pool", "c2")];
    expect(diffCompanySeats("c1", ITEMS, allocations, hub([hubItem(7, BP, 2, 1), hubItem(9, CHROME, 1, 0)]))).toEqual([]);
  });

  it("before license:import runs, every portal seat shows as missing on the Hub", () => {
    const allocations = [alloc("i-bp", "pool"), alloc("i-bp", "order"), alloc("i-def", "pool")];
    expect(diffCompanySeats("c1", ITEMS, allocations, hub([]))).toEqual([
      { kind: "license", vendor: "Microsoft", product: BP.product, portal: { total: 2, fromPool: 1, toOrder: 1 }, hub: { total: 0, fromPool: 0, toOrder: 0 } },
      { kind: "license", vendor: "Microsoft", product: DEF.product, portal: { total: 1, fromPool: 1, toOrder: 0 }, hub: { total: 0, fromPool: 0, toOrder: 0 } },
    ]);
  });

  it("reports pool/order splits that differ, and Hub-only products", () => {
    const allocations = [alloc("i-bp", "pool"), alloc("i-bp", "pool")];
    const out = diffCompanySeats("c1", ITEMS, allocations, hub([hubItem(7, BP, 1, 1), hubItem(8, DEF, 3, 0)]));
    expect(out.map((d) => [d.product, d.portal.total, d.hub.total, d.portal.fromPool, d.hub.fromPool])).toEqual([
      [BP.product, 2, 2, 2, 1],
      [DEF.product, 0, 3, 0, 3],
    ]);
  });
});

describe("hubCompanySeats (hub)", () => {
  it("summarises the Hub's seats on the matching portal items, keeping the portal's assignments", () => {
    const assignments = [assign("i-bp", "u1")];
    const out = hubCompanySeats("c1", ITEMS, assignments, hub([hubItem(7, BP, 2, 1), hubItem(9, CHROME, 1, 0)]), APPS);
    expect("seats" in out && out.seats).toEqual([
      { itemId: "i-bp", held: 3, toOrder: 1, assigned: 1, free: 2, unlimited: false },
      { itemId: "i-chrome", held: 1, toOrder: 0, assigned: 0, free: 0, unlimited: true },
    ]);
  });

  it("refuses when a Hub product is not on the portal pool, or matches two portal items", () => {
    const stranger = { ...hubItem(11, BP, 1, 0), product: "Copilot" };
    expect(hubCompanySeats("c1", ITEMS, [], hub([stranger]), APPS)).toEqual({ unmatched: ["Microsoft Copilot (hub product 11)"] });
    const twin = { ...BP, id: "i-bp-2" };
    expect("unmatched" in hubCompanySeats("c1", [...ITEMS, twin], [], hub([hubItem(7, BP, 1, 0)]), APPS)).toBe(true);
  });
});

describe("hubOrPortalCompanySeats (hub mode, per-company fallback)", () => {
  const allocations = [alloc("i-bp", "pool"), alloc("i-bp", "pool")];
  const input = (hubAccountId: string | null) => ({ client: { id: "c1", hubAccountId }, items: ITEMS, allocations, assignments: [], appIds: APPS });
  const portalSeats = [{ itemId: "i-bp", held: 2, toOrder: 0, assigned: 0, free: 2, unlimited: false }];

  it("serves the Hub when it answers", async () => {
    const fetchHub = vi.fn(async () => hub([hubItem(7, BP, 4, 0)]));
    expect(await hubOrPortalCompanySeats(input("41"), fetchHub)).toEqual([{ itemId: "i-bp", held: 4, toOrder: 0, assigned: 0, free: 4, unlimited: false }]);
    expect(fetchHub).toHaveBeenCalledWith("41", "c1");
  });

  it("falls back to the portal with no hub_account_id, without calling the Hub", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    const fetchHub = vi.fn();
    expect(await hubOrPortalCompanySeats(input(null), fetchHub)).toEqual(portalSeats);
    expect(fetchHub).not.toHaveBeenCalled();
  });

  it("falls back to the portal when the Hub fails, throws or sends unmatched products", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(await hubOrPortalCompanySeats(input("41"), async () => null)).toEqual(portalSeats);
    expect(await hubOrPortalCompanySeats(input("41"), async () => Promise.reject(new Error("boom")))).toEqual(portalSeats);
    expect(await hubOrPortalCompanySeats(input("41"), async () => hub([{ ...hubItem(11, BP, 1, 0), product: "Copilot" }]))).toEqual(portalSeats);
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

describe("shadowCompareCompany", () => {
  const input = { client: { id: "c1", hubAccountId: "41" }, items: ITEMS, allocations: [alloc("i-bp", "pool")], assignments: [], appIds: APPS };

  it("logs nothing when the two sides agree", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(await shadowCompareCompany(input, async () => hub([hubItem(7, BP, 1, 0)]))).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs one line per company with only the differing products' seat counts", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    await shadowCompareCompany(input, async () => hub([]));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe("license-board shadow: seat differences");
    expect(warn.mock.calls[0][1]).toEqual({
      clientId: "c1",
      accountId: "41",
      differences: [{ kind: "license", vendor: "Microsoft", product: BP.product, portal: { total: 1, fromPool: 1, toOrder: 0 }, hub: { total: 0, fromPool: 0, toOrder: 0 } }],
    });
  });

  it("never throws when the Hub read fails", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    await expect(shadowCompareCompany(input, async () => Promise.reject(new Error("boom")))).resolves.toBeNull();
  });
});
