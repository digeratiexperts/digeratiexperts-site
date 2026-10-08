/**
 * Website / Store / Portal projection of the Intelligence Hub authority:
 * docs/de-canonical/08_DE_IDENTITY_LOCATION_NETWORK_STANDARD.md
 *
 * This file is not an independent source of truth. Keep the version aligned
 * with the Hub policy and DE Tech Tool projection.
 */
export const DE_IDENTITY_LOCATION_NETWORK_STANDARD_VERSION = "1.0.0" as const;

export const DE_IDENTITY_NAMING = {
  internalPrimary: "firstname.lastname@clientdomain",
  externalPrimary: "firstname.lastname-ext@clientdomain",
  externalSuffix: "-ext",
  adminSuffix: "-admin",
  privilegedSuffix: "-priv",
  endpointRecoveryAccount: "DE-BreakGlass",
  tenantEmergencyAccounts: ["emergency-admin-01", "emergency-admin-02"],
  techLevelIsRbac: true,
} as const;

export const DE_DEVICE_NAMING = {
  pattern: "<CLIENT>-<ROLE>-<ASSET4>",
  maxWindowsHostnameLength: 15,
  roleCodes: ["LAP", "DSK", "SRV", "KSK", "POS", "TAB", "VDI", "NET", "PRN", "IOT"],
  includesLocation: false,
} as const;

export const DE_LOCATION_NAMING = {
  hierarchy: ["country", "region", "city", "site", "building", "floor", "room", "desk-or-cube"],
  pattern: "<COUNTRY>-<REGION>-<CITY>-S##[-B##][-F##][-R####][-(D|C)###]",
  remotePattern: "<COUNTRY>-<REGION>-REM",
} as const;

export const DE_NETWORK_ADDRESSING = {
  modes: ["de-net-new", "adopt-existing"],
  preferredClientPrefix: 16,
  standardSitePrefix: 20,
  standardSegmentPrefix: 24,
  roomDeskEncodedInIp: false,
  forceRenumberInheritedForConvention: false,
  hostRange: {
    gateway: ".1",
    infrastructureStatic: ".2-.49",
    ordinaryDhcp: ".50-.229",
    reservations: ".230-.249",
    networkHaReserve: ".250-.254",
  },
  segments: [
    { slot: 0, vlanId: 10, key: "management" },
    { slot: 1, vlanId: 20, key: "infrastructure" },
    { slot: 2, vlanId: 30, key: "corp-wired" },
    { slot: 3, vlanId: 40, key: "corp-wireless" },
    { slot: 4, vlanId: 50, key: "voice" },
    { slot: 5, vlanId: 60, key: "printers-iot" },
    { slot: 6, vlanId: 70, key: "cameras-physical-security" },
    { slot: 7, vlanId: 80, key: "guest" },
    { slot: 8, vlanId: 90, key: "ot-warehouse" },
    { slot: 9, vlanId: 100, key: "pos-kiosk" },
    { slot: 10, vlanId: 110, key: "security-tooling" },
    { slot: 11, vlanId: 120, key: "dmz" },
    { slot: 12, vlanId: 130, key: "transit-vpn" },
  ],
} as const;

export type DePersonClass = "internal" | "external";
export type DeHumanAccountKind = "daily" | "admin" | "priv";

function token(value: string, field: string): string {
  const out = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!out) throw new Error(`${field} has no usable account-name characters`);
  return out;
}

export function canonicalHumanStem(input: {
  firstName: string;
  lastName: string;
  personClass?: DePersonClass;
  accountKind?: DeHumanAccountKind;
}): string {
  const base = `${token(input.firstName, "firstName")}.${token(input.lastName, "lastName")}`;
  const privilege =
    input.accountKind === "admin" ? "-admin" : input.accountKind === "priv" ? "-priv" : "";
  const person = input.personClass === "external" ? "-ext" : "";
  return `${base}${privilege}${person}`;
}
