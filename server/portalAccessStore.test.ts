import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Entitlements default OFF (lane-a-update-2.md §3): a company with no record
 * holds nothing, so its menu item stays hidden. Memory mode (no database), the
 * same fallback the dev server and route tests use.
 */

vi.mock("./db", () => ({ db: null, dbReady: false, initPromise: Promise.resolve() }));

import {
  _resetPortalAccessMemory,
  getEntitlements,
  hasSharedFiles,
  listEntitlementRecords,
  setEntitlement,
  writeAudit,
  recentAudit,
} from "./portalAccessStore";

beforeEach(() => {
  _resetPortalAccessMemory();
});

describe("entitlements", () => {
  it("holds nothing by default", async () => {
    expect(await getEntitlements("c-a")).toEqual([]);
    expect(await getEntitlements(null)).toEqual([]);
  });

  it("grants and ends one entitlement at a time", async () => {
    await setEntitlement({ clientId: "c-a", entitlement: "cloud_edge", status: "active", grantedBy: "u-staff" });
    expect(await getEntitlements("c-a")).toEqual(["cloud_edge"]);
    expect(await getEntitlements("c-b")).toEqual([]);

    await setEntitlement({ clientId: "c-a", entitlement: "voice", status: "active" });
    expect((await getEntitlements("c-a")).sort()).toEqual(["cloud_edge", "voice"]);

    await setEntitlement({ clientId: "c-a", entitlement: "cloud_edge", status: "ended" });
    expect(await getEntitlements("c-a")).toEqual(["voice"]);

    const records = await listEntitlementRecords("c-a");
    expect(records.map((r) => `${r.entitlement}:${r.status}`).sort()).toEqual([
      "cloud_edge:ended",
      "voice:active",
    ]);
  });

  it("rejects an unknown entitlement key", async () => {
    await expect(
      setEntitlement({ clientId: "c-a", entitlement: "free_coffee" as never, status: "active" }),
    ).rejects.toThrow();
  });
});

describe("audit rows", () => {
  it("records the break-glass flag per action", async () => {
    await writeAudit({
      actorUserId: "u-break",
      actorEmail: "boss@de.test",
      accountClass: "super_admin",
      breakGlass: true,
      action: "POST /api/portal/admin/companies/c-a",
    });
    await writeAudit({
      actorUserId: "u-staff",
      accountClass: "de_staff",
      breakGlass: false,
      action: "PUT /api/portal/admin/companies/c-a/entitlements",
    });
    const rows = await recentAudit();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.actorUserId === "u-break")?.breakGlass).toBe(true);
    expect(rows.find((r) => r.actorUserId === "u-staff")?.breakGlass).toBe(false);
  });
});

describe("nav datum: shared files", () => {
  it("reports false without a database (nothing durable to show)", async () => {
    expect(await hasSharedFiles("c-a")).toBe(false);
    expect(await hasSharedFiles(null)).toBe(false);
  });
});
