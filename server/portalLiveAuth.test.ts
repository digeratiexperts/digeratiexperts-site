import { describe, expect, it } from "vitest";
import { resolveLivePortalAuthorization } from "./portalLiveAuth";

const decoded = {
  userId: "user-1",
  email: "person@example.com",
  role: "admin",
  storeRole: "comanaged",
  clientId: "current-client",
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

const targetClient = {
  id: "client-target",
  companyName: "Target Company (Live)",
  contactEmail: "owner@target.example.com",
  status: "active",
};

const currentClient = {
  id: "current-client",
  companyName: "Current Company",
  contactEmail: "owner@current.example.com",
  status: "active",
};

const resolveClient = (id: string) =>
  id === currentClient.id ? currentClient : id === targetClient.id ? targetClient : undefined;

describe("live portal authorization", () => {
  it("uses current live authorization fields when the signed tenant is unchanged", () => {
    const result = resolveLivePortalAuthorization(decoded, live, resolveClient);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({
      id: "user-1",
      role: "user",
      storeRole: "managed",
      clientId: "current-client",
    });
  });

  it("rejects a session after a cross-tenant reassignment instead of remapping", () => {
    expect(resolveLivePortalAuthorization({ ...decoded, clientId: "old-client" }, live, resolveClient)).toEqual({
      ok: false,
      status: 401,
      error: "Portal session tenant is invalid",
    });
  });

  it("rejects missing or empty tenant claims that do not match the live tenant", () => {
    expect(resolveLivePortalAuthorization({ ...decoded, clientId: null }, live, resolveClient)).toEqual({
      ok: false,
      status: 401,
      error: "Portal session tenant is invalid",
    });
    expect(resolveLivePortalAuthorization({ ...decoded, clientId: "" }, live, resolveClient)).toEqual({
      ok: false,
      status: 401,
      error: "Portal session tenant is invalid",
    });
    expect(
      resolveLivePortalAuthorization(
        { ...decoded, clientId: "current-client" },
        { ...live, clientId: null },
        resolveClient,
      ),
    ).toEqual({
      ok: false,
      status: 401,
      error: "Portal session tenant is invalid",
    });
  });

  it("accepts an unchanged tenantless session", () => {
    const token = { ...decoded, clientId: null };
    const result = resolveLivePortalAuthorization(token, { ...live, clientId: null });
    expect(result.ok).toBe(true);
  });

  it("treats anything other than an explicit live isActive=true as disabled", () => {
    expect(resolveLivePortalAuthorization(decoded, { ...live, isActive: false }, resolveClient)).toEqual({
      ok: false,
      status: 403,
      error: "Portal account is disabled",
    });
    expect(resolveLivePortalAuthorization(decoded, { ...live, isActive: undefined }, resolveClient)).toEqual({
      ok: false,
      status: 403,
      error: "Portal account is disabled",
    });
  });

  it("rejects existing sessions when the assigned client is missing or no longer active", () => {
    expect(resolveLivePortalAuthorization(decoded, live, () => undefined)).toEqual({
      ok: false,
      status: 403,
      error: "Portal client account is inactive",
    });
    for (const status of ["inactive", "suspended", "deleted", null]) {
      expect(
        resolveLivePortalAuthorization(decoded, live, () => ({ ...currentClient, status })),
      ).toEqual({
        ok: false,
        status: 403,
        error: "Portal client account is inactive",
      });
    }
  });

  it("allows an active prospect workspace without treating it as a suspended client", () => {
    expect(
      resolveLivePortalAuthorization(decoded, live, () => ({ ...currentClient, status: "prospect" })).ok,
    ).toBe(true);
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

  it("fails closed when a non-admin presents impersonation claims", () => {
    const impersonating = {
      ...decoded,
      impersonatingCompanyId: "client-target",
      impersonatingCompanyName: "Target Company",
    };

    expect(resolveLivePortalAuthorization(impersonating, live, resolveClient)).toEqual({
      ok: false,
      status: 403,
      error: "Impersonation is not permitted",
    });
  });

  it("fails closed when a name-only impersonation claim is presented by a non-admin", () => {
    expect(
      resolveLivePortalAuthorization(
        { ...decoded, impersonatingCompanyName: "Target Company" },
        live,
        resolveClient,
      ),
    ).toEqual({
      ok: false,
      status: 403,
      error: "Impersonation is not permitted",
    });
  });

  it("allows admin impersonation only when the live admin and target client both exist", () => {
    const impersonating = {
      ...decoded,
      impersonatingCompanyId: "client-target",
      impersonatingCompanyName: "Stale or forged name",
    };
    const admin = resolveLivePortalAuthorization(
      impersonating,
      { ...live, role: "admin" },
      resolveClient,
    );

    expect(admin.ok).toBe(true);
    if (!admin.ok) return;
    expect(admin.user.role).toBe("admin");
    expect(admin.user.impersonatingCompanyId).toBe("client-target");
    expect(admin.user.impersonatingCompanyName).toBe("Target Company (Live)");
  });

  it("rejects a missing admin impersonation target", () => {
    const impersonating = {
      ...decoded,
      impersonatingCompanyId: "missing-client",
      impersonatingCompanyName: "Forged name",
    };
    expect(
      resolveLivePortalAuthorization(
        impersonating,
        { ...live, role: "admin" },
        (id) => (id === currentClient.id ? currentClient : undefined),
      ),
    ).toEqual({
      ok: false,
      status: 403,
      error: "Impersonation is not permitted",
    });
  });
});
