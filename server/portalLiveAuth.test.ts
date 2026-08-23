import { describe, expect, it } from "vitest";
import { resolveLivePortalAuthorization } from "./portalLiveAuth";

const decoded = {
  userId: "user-1",
  email: "person@example.com",
  role: "admin",
  storeRole: "comanaged",
  clientId: "old-client",
};

const live = {
  id: "user-1",
  email: "person@example.com",
  fullName: "Person Example",
  password: "not-used",
  role: "user",
  storeRole: "managed",
  clientId: "current-client",
  orgRole: "staff",
  isActive: true,
};

describe("live portal authorization", () => {
  it("uses current roles and tenant assignment instead of JWT authorization claims", () => {
    const result = resolveLivePortalAuthorization(decoded, live);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({
      id: "user-1",
      role: "user",
      storeRole: "managed",
      clientId: "current-client",
    });
  });

  it("rejects a disabled user with an otherwise valid token", () => {
    expect(resolveLivePortalAuthorization(decoded, { ...live, isActive: false })).toEqual({
      ok: false,
      status: 403,
      error: "Portal account is disabled",
    });
  });

  it("rejects a token when the live user no longer exists", () => {
    expect(resolveLivePortalAuthorization(decoded, null)).toEqual({
      ok: false,
      status: 401,
      error: "Portal account no longer exists",
    });
  });

  it("rejects a token whose identity no longer matches the live record", () => {
    expect(resolveLivePortalAuthorization(decoded, { ...live, id: "user-2" })).toEqual({
      ok: false,
      status: 401,
      error: "Portal session identity is invalid",
    });
  });

  it("preserves impersonation only while the live user is still an admin", () => {
    const impersonating = {
      ...decoded,
      impersonatingCompanyId: "client-target",
      impersonatingCompanyName: "Target Company",
    };

    const downgraded = resolveLivePortalAuthorization(impersonating, live);
    expect(downgraded.ok && downgraded.user.impersonatingCompanyId).toBeNull();

    const admin = resolveLivePortalAuthorization(impersonating, { ...live, role: "admin" });
    expect(admin.ok && admin.user.impersonatingCompanyId).toBe("client-target");
  });
});
