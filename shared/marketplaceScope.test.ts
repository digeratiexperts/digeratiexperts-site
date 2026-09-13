import { describe, expect, it } from "vitest";
import {
  MARKETPLACE_SCOPE_STATES,
  resolvePortalMarketplaceScope,
} from "./marketplaceScope";

describe("resolvePortalMarketplaceScope", () => {
  it("exposes the four authoritative states", () => {
    expect([...MARKETPLACE_SCOPE_STATES]).toEqual([
      "SCOPED",
      "AUTHORIZED_GLOBAL",
      "UNMAPPED",
      "AUTHORITY_UNAVAILABLE",
    ]);
  });

  it("fail-closes UNMAPPED and never treats it as unrestricted", () => {
    const result = resolvePortalMarketplaceScope({ clientId: null });
    expect(result.status).toBe("UNMAPPED");
    expect(result.trustedClientIds).toEqual([]);
    expect(result.items).toEqual([]);
    expect(result.failClosed).toBe(true);
    expect(result.status).not.toBe("AUTHORIZED_GLOBAL");
    expect(result.trustedClientIds).not.toBeNull();
  });

  it("never infers AUTHORIZED_GLOBAL from a missing mapping", () => {
    const result = resolvePortalMarketplaceScope({});
    expect(result.status).toBe("UNMAPPED");
    expect(result.status).not.toBe("AUTHORIZED_GLOBAL");
  });

  it("returns AUTHORITY_UNAVAILABLE for a mapped tenant when Hub catalog is not ready", () => {
    const result = resolvePortalMarketplaceScope({
      clientId: "client-1",
      hubCatalog: "not_attempted",
    });
    expect(result.status).toBe("AUTHORITY_UNAVAILABLE");
    expect(result.trustedClientIds).toEqual(["client-1"]);
    expect(result.items).toEqual([]);
    expect(result.failClosed).toBe(true);
  });

  it("fail-closes AUTHORITY_UNAVAILABLE on Hub lookup error without widening", () => {
    const result = resolvePortalMarketplaceScope({
      clientId: "client-1",
      hubCatalog: "error",
    });
    expect(result.status).toBe("AUTHORITY_UNAVAILABLE");
    expect(result.trustedClientIds).toEqual(["client-1"]);
    expect(result.items).toEqual([]);
    expect(result.failClosed).toBe(true);
  });

  it("returns SCOPED only when tenant is mapped and Hub catalog authority resolved", () => {
    const result = resolvePortalMarketplaceScope({
      clientId: "client-9",
      hubCatalog: "resolved",
    });
    expect(result.status).toBe("SCOPED");
    expect(result.trustedClientIds).toEqual(["client-9"]);
    expect(result.items).toEqual([]);
    expect(result.failClosed).toBe(false);
  });

  it("requires an explicit flag for AUTHORIZED_GLOBAL", () => {
    const result = resolvePortalMarketplaceScope({
      clientId: null,
      authorizedGlobal: true,
    });
    expect(result.status).toBe("AUTHORIZED_GLOBAL");
    expect(result.trustedClientIds).toBeNull();
    expect(result.failClosed).toBe(false);
  });
});
