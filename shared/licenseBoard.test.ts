import { describe, expect, it } from "vitest";
import {
  departmentSeats,
  planAllocation,
  releaseOrder,
  summarizeCompany,
  summarizePool,
  type LicenseAllocation,
  type LicenseAssignment,
  type LicensePoolItem,
} from "./licenseBoard";

const item = (id: string, quantity: number): LicensePoolItem => ({
  id,
  kind: "license",
  vendor: "Microsoft",
  product: id,
  category: "Productivity",
  catalogKey: null,
  sku: null,
  chocoPackage: null,
  quantity,
  createdAt: "2026-10-08T00:00:00.000Z",
});
const alloc = (id: string, itemId: string, clientId: string, source: "pool" | "order", at = "2026-10-08T00:00:00.000Z"): LicenseAllocation => ({
  id,
  itemId,
  clientId,
  source,
  createdAt: at,
});
const assign = (
  id: string,
  itemId: string,
  targetType: LicenseAssignment["targetType"],
  targetId: string,
  clientId = "c1",
): LicenseAssignment => ({
  id,
  clientId,
  itemId,
  targetType,
  targetId,
  targetLabel: targetId,
  viaDepartmentId: null,
  createdAt: "2026-10-08T00:00:00.000Z",
});

describe("license patch bay counts", () => {
  it("uses DE's pool first and orders the rest", () => {
    expect(planAllocation(3, 5)).toEqual({ fromPool: 3, toOrder: 2 });
    expect(planAllocation(10, 2)).toEqual({ fromPool: 2, toOrder: 0 });
    expect(planAllocation(0, 1)).toEqual({ fromPool: 0, toOrder: 1 });
  });

  it("counts pool seats handed out, seats to order and what is left", () => {
    const [bp] = summarizePool(
      [item("bp", 5)],
      [alloc("a1", "bp", "c1", "pool"), alloc("a2", "bp", "c2", "pool"), alloc("a3", "bp", "c1", "order")],
    );
    expect(bp).toMatchObject({ allocated: 2, toOrder: 1, free: 3 });
  });

  it("gives each company its own free pool: held minus what departments, people and devices use", () => {
    const allocations = [alloc("a1", "bp", "c1", "pool"), alloc("a2", "bp", "c1", "pool"), alloc("a3", "bp", "c1", "order"), alloc("a4", "bp", "c2", "pool")];
    const assignments = [assign("s1", "bp", "department", "sales"), assign("s2", "bp", "user", "u1")];
    expect(summarizeCompany("c1", allocations, assignments)).toEqual([
      { itemId: "bp", held: 3, toOrder: 1, assigned: 2, free: 1, unlimited: false },
    ]);
    expect(departmentSeats("c1", "sales", assignments).get("bp")).toBe(1);
  });

  it("releases un-bought seats before pool seats, newest first", () => {
    const order = releaseOrder([
      alloc("old-pool", "bp", "c1", "pool", "2026-10-01T00:00:00.000Z"),
      alloc("new-pool", "bp", "c1", "pool", "2026-10-07T00:00:00.000Z"),
      alloc("order", "bp", "c1", "order", "2026-10-02T00:00:00.000Z"),
    ]).map((a) => a.id);
    expect(order).toEqual(["order", "new-pool", "old-pool"]);
  });

  it("treats an app as on or off for a company, with no seat limit", () => {
    const [row] = summarizeCompany(
      "c1",
      [alloc("a1", "7zip", "c1", "pool")],
      [assign("s1", "7zip", "user", "u1"), assign("s2", "7zip", "user", "u2"), assign("s3", "7zip", "device", "device:*")],
      new Set(["7zip"]),
    );
    expect(row).toEqual({ itemId: "7zip", held: 1, toOrder: 0, assigned: 3, free: 0, unlimited: true });
  });
});
