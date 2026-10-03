import { describe, expect, it } from "vitest";
import {
  claimSolution,
  createSolution,
  findSolution,
  getSolution,
  parseCartPayload,
  serializeCartPayload,
  SolutionOwnershipError,
  solutionOwnedBy,
  upsertSolution,
} from "./storeSolutionStore";

describe("store solution store", () => {
  it("persists a guest solution and recalculates catalog totals", () => {
    const created = createSolution("session-a");
    const saved = upsertSolution({
      id: created.id,
      sessionId: "session-a",
      items: [{ productId: "prod-010", sku: "DE-SVC-CM-ENDPOINT-CORE-MO", quantity: 5 }],
    });
    expect(saved.id).toBe(created.id);
    expect(saved.snapshot.totals.monthly).toBe(195);
    expect(saved.snapshot.lines[0].name).toContain("Endpoint");
  });

  it("merges guest and authenticated solutions without dropping either side", () => {
    const guest = upsertSolution({
      sessionId: "guest-merge",
      items: [{ productId: "prod-010", sku: "DE-SVC-CM-ENDPOINT-CORE-MO", quantity: 4 }],
    });
    upsertSolution({
      sessionId: "user-session",
      userId: "user-1",
      items: [{ productId: "prod-011", sku: "DE-SVC-CM-ENDPOINT-EDR-MO", quantity: 2 }],
    });
    const claimed = claimSolution(guest.sessionId, "user-1");
    const ids = claimed.items.map((item) => item.productId).sort();
    expect(ids).toEqual(["prod-010", "prod-011"]);
    expect(claimed.items.find((item) => item.productId === "prod-010")?.quantity).toBe(4);
  });

  it("round-trips solution payload inside store_carts items jsonb", () => {
    const saved = upsertSolution({
      sessionId: "payload-session",
      items: [{ productId: "prod-010", quantity: 3 }],
      savedForLater: [{ productId: "prod-080", quantity: 1 }],
      name: "Office stack",
    });
    const encoded = serializeCartPayload(saved);
    expect(encoded.version).toBe(1);
    const decoded = parseCartPayload(encoded);
    expect(decoded.items).toEqual(saved.items);
    expect(decoded.savedForLater).toEqual(saved.savedForLater);
    expect(decoded.name).toBe("Office stack");
  });

  it("reads legacy cart arrays that only stored product lines", () => {
    const decoded = parseCartPayload([{ productId: "prod-010", quantity: 2 }]);
    expect(decoded.items).toEqual([{ productId: "prod-010", quantity: 2 }]);
    expect(decoded.savedForLater).toEqual([]);
  });
});


describe("store solution ownership (#244)", () => {
  it("refuses to overwrite a guest solution from another session that knows its id", () => {
    const victim = upsertSolution({
      sessionId: "victim-session",
      items: [{ productId: "prod-010", quantity: 5 }],
    });
    expect(() =>
      upsertSolution({ id: victim.id, sessionId: "attacker-session", items: [{ productId: "prod-011", quantity: 1 }] }),
    ).toThrow(SolutionOwnershipError);
    const after = getSolution(victim.id)!;
    expect(after.sessionId).toBe("victim-session");
    expect(after.items).toEqual([{ productId: "prod-010", quantity: 5 }]);
  });

  it("refuses to rebind a user's solution to another signed-in user, even on the same session", () => {
    const owned = upsertSolution({
      sessionId: "shared-device",
      userId: "user-a",
      items: [{ productId: "prod-010", quantity: 2 }],
    });
    expect(() =>
      upsertSolution({ id: owned.id, sessionId: "shared-device", userId: "user-b", items: [] }),
    ).toThrow(SolutionOwnershipError);
    expect(() =>
      upsertSolution({ id: owned.id, sessionId: "other-device", items: [] }),
    ).toThrow(SolutionOwnershipError);
    expect(getSolution(owned.id)!.userId).toBe("user-a");
    // Without an id, user B on the shared device gets their own record, not A's.
    const mine = upsertSolution({ sessionId: "shared-device", userId: "user-b", items: [] });
    expect(mine.id).not.toBe(owned.id);
    expect(getSolution(owned.id)!.userId).toBe("user-a");
  });

  it("still lets the owner save by id from their session or, signed in, from another device", () => {
    const guest = upsertSolution({ sessionId: "owner-session", items: [] });
    const saved = upsertSolution({ id: guest.id, sessionId: "owner-session", items: [{ productId: "prod-010", quantity: 1 }] });
    expect(saved.id).toBe(guest.id);

    const userOwned = upsertSolution({ sessionId: "laptop", userId: "user-c", items: [] });
    const fromPhone = upsertSolution({ id: userOwned.id, sessionId: "phone", userId: "user-c", items: [{ productId: "prod-010", quantity: 3 }] });
    expect(fromPhone.id).toBe(userOwned.id);
    expect(fromPhone.items[0].quantity).toBe(3);
  });

  it("does not find another session's solution by id", () => {
    const victim = upsertSolution({ sessionId: "victim-2", items: [] });
    expect(findSolution({ id: victim.id, sessionId: "attacker-2" })).toBeUndefined();
    expect(findSolution({ id: victim.id, sessionId: "victim-2" })?.id).toBe(victim.id);
  });

  it("claim never takes over another user's record that shares the browser session", () => {
    const a = upsertSolution({ sessionId: "kiosk", userId: "user-x", items: [{ productId: "prod-010", quantity: 1 }] });
    const claimed = claimSolution("kiosk", "user-y");
    expect(claimed.id).not.toBe(a.id);
    expect(getSolution(a.id)!.userId).toBe("user-x");
  });

  it("decides ownership from the record's user first, then the session", () => {
    expect(solutionOwnedBy({ sessionId: "s1", userId: null }, { sessionId: "s1" })).toBe(true);
    expect(solutionOwnedBy({ sessionId: "s1", userId: null }, { sessionId: "s2" })).toBe(false);
    expect(solutionOwnedBy({ sessionId: "s1", userId: null }, { sessionId: "" })).toBe(false);
    expect(solutionOwnedBy({ sessionId: "", userId: null }, { sessionId: "" })).toBe(false);
    expect(solutionOwnedBy({ sessionId: "s1", userId: "u1" }, { sessionId: "s9", userId: "u1" })).toBe(true);
    expect(solutionOwnedBy({ sessionId: "s1", userId: "u1" }, { sessionId: "s1", userId: "u2" })).toBe(false);
    expect(solutionOwnedBy({ sessionId: "s1", userId: "u1" }, { sessionId: "s1" })).toBe(true);
  });
});
