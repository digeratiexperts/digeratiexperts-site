import { describe, expect, it } from "vitest";
import {
  isEligibleDepartmentItContact,
  resolveDepartmentMutationScope,
} from "./portalDepartmentAuthorization";

describe("portal department authorization", () => {
  it("keeps non-admin mutations inside the actor tenant", () => {
    expect(
      resolveDepartmentMutationScope({ role: "user", clientId: "client-a" }, undefined),
    ).toEqual({ ok: true, clientId: "client-a" });
    expect(
      resolveDepartmentMutationScope({ role: "user", clientId: "client-a" }, "client-b"),
    ).toEqual({ ok: false, status: 404, error: "Department not found" });
  });

  it("allows an admin to select an explicit tenant", () => {
    expect(resolveDepartmentMutationScope({ role: "admin" }, "client-b")).toEqual({
      ok: true,
      clientId: "client-b",
    });
  });

  it("accepts only active IT contacts from the target tenant", () => {
    expect(isEligibleDepartmentItContact({ id: "a", clientId: "client-a", isActive: true }, "client-a")).toBe(true);
    expect(isEligibleDepartmentItContact({ id: "b", clientId: "client-b", isActive: true }, "client-a")).toBe(false);
    expect(isEligibleDepartmentItContact({ id: "a", clientId: "client-a", isActive: false }, "client-a")).toBe(false);
  });
});
