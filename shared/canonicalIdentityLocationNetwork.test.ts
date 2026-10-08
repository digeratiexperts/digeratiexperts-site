import { describe, expect, it } from "vitest";
import {
  canonicalHumanStem,
  DE_DEVICE_NAMING,
  DE_IDENTITY_LOCATION_NETWORK_STANDARD_VERSION,
  DE_IDENTITY_NAMING,
  DE_LOCATION_NAMING,
  DE_NETWORK_ADDRESSING,
} from "./canonicalIdentityLocationNetwork";

describe("website projection of DE canonical identity/location/network standard", () => {
  it("pins the same standard version and owner-approved naming patterns", () => {
    expect(DE_IDENTITY_LOCATION_NETWORK_STANDARD_VERSION).toBe("1.0.0");
    expect(DE_IDENTITY_NAMING.internalPrimary).toBe("firstname.lastname@clientdomain");
    expect(DE_IDENTITY_NAMING.externalPrimary).toBe("firstname.lastname-ext@clientdomain");
    expect(DE_IDENTITY_NAMING.techLevelIsRbac).toBe(true);
  });

  it("keeps privilege separate and leaves -ext last", () => {
    expect(canonicalHumanStem({ firstName: "Jane", lastName: "Smith" })).toBe("jane.smith");
    expect(canonicalHumanStem({
      firstName: "John",
      lastName: "Doe",
      personClass: "external",
      accountKind: "admin",
    })).toBe("john.doe-admin-ext");
    expect(canonicalHumanStem({
      firstName: "John",
      lastName: "Doe",
      personClass: "external",
      accountKind: "priv",
    })).toBe("john.doe-priv-ext");
  });

  it("keeps device, location and network boundaries separate", () => {
    expect(DE_DEVICE_NAMING.pattern).toBe("<CLIENT>-<ROLE>-<ASSET4>");
    expect(DE_DEVICE_NAMING.includesLocation).toBe(false);
    expect(DE_LOCATION_NAMING.hierarchy).toContain("desk-or-cube");
    expect(DE_NETWORK_ADDRESSING.roomDeskEncodedInIp).toBe(false);
    expect(DE_NETWORK_ADDRESSING.forceRenumberInheritedForConvention).toBe(false);
    expect(DE_NETWORK_ADDRESSING.segments.find((x) => x.key === "guest")?.vlanId).toBe(80);
  });
});
