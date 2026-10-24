import { describe, expect, it } from "vitest";
import {
  CLIENT_ROLES,
  accountClassOf,
  can,
  effectiveClientRoles,
  ruleAllows,
  type AccessPrincipal,
  type ClientRole,
} from "./index";

const superAdmin: AccessPrincipal = { role: "admin", clientId: "c-de" };
const deStaff: AccessPrincipal = { role: "staff", clientId: "c-de", orgRole: "staff" };
const plainUser: AccessPrincipal = { role: "user", clientId: "c-a", orgRole: "staff" };
const manager: AccessPrincipal = { role: "user", clientId: "c-a", orgRole: "manager" };
const itContact: AccessPrincipal = {
  role: "user",
  clientId: "c-a",
  orgRole: "company_it_contact",
  isCompanyItContact: true,
};

const DE_ONLY_PERMS = [
  "company.switch",
  "company.manage",
  "clientRoles.manage",
  "entitlements.manage",
  "files.share",
] as const;
const SUPER_ADMIN_ONLY_PERMS = [
  "portal.admin",
  "company.delete",
  "admin.settings",
  "admin.authConfig",
  "admin.staffRoles",
  "admin.billingConfig",
  "admin.integrationConfig",
  "audit.read",
] as const;

describe("account classes", () => {
  it("maps the existing role values onto the three account types", () => {
    expect(accountClassOf(superAdmin)).toBe("super_admin");
    expect(accountClassOf(deStaff)).toBe("de_staff");
    expect(accountClassOf(plainUser)).toBe("client");
    expect(accountClassOf({ role: "viewer" })).toBe("client");
  });
});

describe("break-glass (role=admin) keeps today's full access", () => {
  it("holds every permission, including unknown ones", () => {
    for (const p of [...DE_ONLY_PERMS, ...SUPER_ADMIN_ONLY_PERMS, "entitlements.read"]) {
      expect(can(superAdmin, p, "c-a"), p).toBe(true);
    }
    expect(can(superAdmin, "permission.that.does.not.exist", "c-a")).toBe(true);
  });

  it("is not tenant-blocked", () => {
    expect(can(superAdmin, "entitlements.read", "c-b")).toBe(true);
    expect(can(superAdmin, "company.switch", "c-b")).toBe(true);
  });
});

describe("DE staff (role=staff) is a client manager, not a break-glass", () => {
  it("holds the client-manager permissions in any company", () => {
    for (const p of DE_ONLY_PERMS) {
      expect(can(deStaff, p, "c-a"), p).toBe(true);
    }
  });

  it("never holds break-glass-only permissions", () => {
    for (const p of SUPER_ADMIN_ONLY_PERMS) {
      expect(can(deStaff, p, "c-de"), p).toBe(false);
    }
  });

  it("denies unknown permissions", () => {
    expect(can(deStaff, "permission.that.does.not.exist", "c-a")).toBe(false);
  });
});

describe("client hats", () => {
  it("derives legacy hats so no account loses access today", () => {
    expect(effectiveClientRoles(plainUser)).toEqual(["standard"]);
    expect(effectiveClientRoles(manager).sort()).toEqual(["approver", "standard"]);
    expect(effectiveClientRoles(itContact).sort()).toEqual([...CLIENT_ROLES].sort());
  });

  it("adds explicit hats without removing the derived ones", () => {
    const explicit: AccessPrincipal = {
      role: "user",
      clientId: "c-a",
      orgRole: "staff",
      clientRoles: ["purchaser"],
    };
    expect(effectiveClientRoles(explicit).sort()).toEqual(["purchaser", "standard"]);
  });

  it("a client never holds DE-only or break-glass-only permissions", () => {
    for (const p of [...DE_ONLY_PERMS, ...SUPER_ADMIN_ONLY_PERMS]) {
      expect(can({ ...itContact, clientRoles: [...CLIENT_ROLES] }, p, "c-a"), p).toBe(false);
    }
  });

  it("gates a rule by hat", () => {
    const rule = { roles: ["billing" as ClientRole] };
    expect(ruleAllows(rule, { principal: { ...plainUser, clientRoles: ["billing"] } })).toBe(true);
    expect(ruleAllows(rule, { principal: plainUser })).toBe(false);
    expect(ruleAllows({ roles: [] }, { principal: itContact })).toBe(false);
    expect(ruleAllows({}, { principal: plainUser })).toBe(true); // every hat
  });
});

describe("tenant isolation (client A cannot reach client B)", () => {
  it("denies a client principal acting on another company", () => {
    expect(can(plainUser, "entitlements.read", "c-a")).toBe(true);
    expect(can(plainUser, "entitlements.read", "c-b")).toBe(false);
  });

  it("denies even a fully-hatted client admin of company A on company B", () => {
    const clientAdmin: AccessPrincipal = {
      role: "user",
      clientId: "c-a",
      orgRole: "company_it_contact",
      clientRoles: [...CLIENT_ROLES],
    };
    expect(can(clientAdmin, "files.read", "c-a")).toBe(true);
    expect(can(clientAdmin, "files.read", "c-b")).toBe(false);
  });

  it("lets DE staff and break-glass act in any company", () => {
    expect(can(deStaff, "company.switch", "c-b")).toBe(true);
    expect(can(superAdmin, "company.switch", "c-b")).toBe(true);
  });

  it("honours scoped: false only when a rule says so", () => {
    expect(ruleAllows({ scoped: false }, { principal: plainUser, companyId: "c-b" })).toBe(true);
  });
});

describe("entitlements on and off (default off)", () => {
  const secureAccess = { entitlement: "cloud_edge" as const };

  it("hides the item while the company holds no entitlement", () => {
    expect(ruleAllows(secureAccess, { principal: plainUser, entitlements: [] })).toBe(false);
    expect(ruleAllows(secureAccess, { principal: plainUser, entitlements: null })).toBe(false);
  });

  it("shows the item when the entitlement is granted", () => {
    expect(ruleAllows(secureAccess, { principal: plainUser, entitlements: ["cloud_edge"] })).toBe(true);
  });

  it("DE staff see it either way; clients still need their own hat", () => {
    expect(ruleAllows(secureAccess, { principal: deStaff, entitlements: [] })).toBe(true);
    expect(
      ruleAllows({ ...secureAccess, roles: ["owner"] as ClientRole[] }, {
        principal: plainUser,
        entitlements: ["cloud_edge"],
      }),
    ).toBe(false);
  });
});

describe("sample and unfinished features", () => {
  it("a client user can never see a sample item (update 1 §2)", () => {
    expect(ruleAllows({ sample: true }, { principal: plainUser })).toBe(false);
    expect(ruleAllows({ featureReady: false }, { principal: plainUser })).toBe(false);
    expect(ruleAllows({ sample: true, featureReady: false }, { principal: itContact })).toBe(false);
  });

  it("DE staff hide samples too; only the break-glass account still sees them (update 3 §3)", () => {
    expect(ruleAllows({ sample: true }, { principal: deStaff })).toBe(false);
    expect(ruleAllows({ featureReady: false }, { principal: deStaff })).toBe(false);
    expect(ruleAllows({ sample: true }, { principal: superAdmin })).toBe(true);
    expect(ruleAllows({ featureReady: false }, { principal: superAdmin })).toBe(true);
  });
});

describe("nav data gates", () => {
  it("hides an item until its datum exists", () => {
    const rule = { requiresData: "sharedFiles" as const };
    expect(ruleAllows(rule, { principal: plainUser, data: { sharedFiles: false } })).toBe(false);
    expect(ruleAllows(rule, { principal: plainUser, data: { sharedFiles: true } })).toBe(true);
    expect(ruleAllows(rule, { principal: plainUser, data: null })).toBe(false);
  });
});

describe("lane D: status.manage", () => {
  it("lets DE staff and the break-glass account manage System Status notices, never a client", () => {
    expect(can(superAdmin, "status.manage")).toBe(true);
    expect(can(deStaff, "status.manage")).toBe(true);
    for (const client of [plainUser, manager, itContact]) {
      expect(can(client, "status.manage"), client.orgRole ?? "").toBe(false);
      expect(can(client, "status.manage", client.clientId)).toBe(false);
    }
  });
});

describe("DE staff tools (lane-staff.ts)", () => {
  const STAFF_TOOL_PERMS = [
    "licenses.manage",
    "kb.manage",
    "orders.manage",
    "manualRecords.manage",
    "warehouse.access",
  ] as const;

  it("lets DE staff and the break-glass account use every DE Admin tool, never a client", () => {
    for (const perm of STAFF_TOOL_PERMS) {
      expect(can(superAdmin, perm), perm).toBe(true);
      expect(can(deStaff, perm), perm).toBe(true);
      expect(can(deStaff, perm, "c-a"), perm).toBe(true);
      for (const client of [plainUser, manager, itContact]) {
        expect(can(client, perm), `${perm} ${client.orgRole}`).toBe(false);
        expect(can(client, perm, client.clientId), `${perm} ${client.orgRole}`).toBe(false);
      }
    }
  });

  it("does not widen the break-glass-only actions (company delete, billing config, the old requireAdmin)", () => {
    for (const perm of ["portal.admin", "company.delete", "admin.billingConfig"] as const) {
      expect(can(deStaff, perm), perm).toBe(false);
    }
  });
});
