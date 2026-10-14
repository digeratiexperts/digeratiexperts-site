import { describe, expect, it } from "vitest";
import { isPortalContext } from "./analytics";

describe("isPortalContext", () => {
  it("is true on the portal host", () => {
    expect(isPortalContext("portal.digeratiexperts.com", "/")).toBe(true);
    expect(isPortalContext("PORTAL.digeratiexperts.com", "/login")).toBe(true);
  });

  it("is true on portal paths of any host", () => {
    expect(isPortalContext("digeratiexperts.com", "/portal")).toBe(true);
    expect(isPortalContext("digeratiexperts.com", "/portal/tickets")).toBe(true);
  });

  it("is false on the public site", () => {
    expect(isPortalContext("digeratiexperts.com", "/")).toBe(false);
    expect(isPortalContext("www.digeratiexperts.com", "/store")).toBe(false);
    expect(isPortalContext("digeratiexperts.com", "/portals-explained")).toBe(false);
  });
});
