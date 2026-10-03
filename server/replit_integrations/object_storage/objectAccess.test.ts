import { describe, expect, it } from "vitest";
import { authorizeObjectRead } from "./objectAccess";

describe("authorizeObjectRead", () => {
  it("allows DE admin regardless of ownership evidence", () => {
    expect(
      authorizeObjectRead(
        { userId: "admin-1", role: "admin", clientId: null },
        { aclAllowsUser: false, tenantOwnerClientId: "other-client" },
      ),
    ).toEqual({ allow: true, reason: "admin" });
  });

  it("allows the ACL owner when metadata grants access", () => {
    expect(
      authorizeObjectRead(
        { userId: "user-a", role: "user", clientId: "client-a" },
        { aclAllowsUser: true, tenantOwnerClientId: null },
      ),
    ).toEqual({ allow: true, reason: "acl_owner" });
  });

  it("allows a tenant member when the object is registered to their client", () => {
    expect(
      authorizeObjectRead(
        { userId: "user-a", role: "user", clientId: "client-a" },
        { aclAllowsUser: false, tenantOwnerClientId: "client-a" },
      ),
    ).toEqual({ allow: true, reason: "tenant_owner" });
  });

  it("denies one authenticated client reading another client's object", () => {
    expect(
      authorizeObjectRead(
        { userId: "user-b", role: "user", clientId: "client-b" },
        { aclAllowsUser: false, tenantOwnerClientId: "client-a" },
      ),
    ).toEqual({ allow: false, reason: "denied" });
  });

  it("denies when ownership cannot be established (no ACL, no tenant row)", () => {
    expect(
      authorizeObjectRead(
        { userId: "user-a", role: "user", clientId: "client-a" },
        { aclAllowsUser: false, tenantOwnerClientId: null },
      ),
    ).toEqual({ allow: false, reason: "denied" });
  });

  it("denies when the subject has no clientId even if a tenant owner exists", () => {
    expect(
      authorizeObjectRead(
        { userId: "user-a", role: "user", clientId: null },
        { aclAllowsUser: false, tenantOwnerClientId: "client-a" },
      ),
    ).toEqual({ allow: false, reason: "denied" });
  });
});
