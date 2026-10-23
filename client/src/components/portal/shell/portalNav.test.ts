import { describe, expect, it } from "vitest";
import {
  PORTAL_NAV_HUBS,
  PORTAL_NAV_ITEMS,
  findNavItem,
  isNavAllowed,
  navGroupsFor,
  type PortalNavContext,
} from "./portalNav";
import type { IntegrationMap } from "@/lib/portalIntegrations";
import type { PortalUserSession } from "@/lib/portalRoles";

const integration = (mode: "sample" | "hidden" | "live") =>
  ({ mode, provider: null }) as const;

const SAMPLE_INT: IntegrationMap = {
  vpn: integration("sample"),
  phone: integration("sample"),
  shipping: integration("sample"),
};
const HIDDEN_INT: IntegrationMap = {
  vpn: integration("hidden"),
  phone: integration("hidden"),
  shipping: integration("hidden"),
};
const LIVE_INT: IntegrationMap = {
  vpn: integration("live"),
  phone: integration("live"),
  shipping: integration("live"),
};

const NO_DATA: PortalNavContext = { entitlements: [], data: { sharedFiles: false, itPlan: false } };

const breakGlass: PortalUserSession = { id: "u-break", email: "boss@de.test", role: "admin", clientId: null };
const deStaff: PortalUserSession = { id: "u-staff", email: "staff@de.test", role: "staff", clientId: "msp-digerati" };
const standardUser: PortalUserSession = {
  id: "u-plain",
  role: "user",
  clientId: "c-a",
  orgRole: "staff",
};
const clientItContact: PortalUserSession = {
  id: "u-it",
  role: "user",
  clientId: "c-a",
  orgRole: "company_it_contact",
  isCompanyItContact: true,
};
const clientViewer: PortalUserSession = { id: "u-viewer", role: "viewer", clientId: "c-a", orgRole: "staff" };

function labels(user: PortalUserSession, int = SAMPLE_INT, ctx: PortalNavContext = NO_DATA): string[] {
  return navGroupsFor(user, int, ctx).flatMap((g) => g.items.map((i) => i.label));
}

function items(user: PortalUserSession, int = SAMPLE_INT, ctx: PortalNavContext = NO_DATA) {
  return navGroupsFor(user, int, ctx).flatMap((g) => g.items);
}

describe("update-2 acceptance: a client user can never see a sample item", () => {
  it("drops every sample / unfinished item for every client role", () => {
    for (const user of [standardUser, clientItContact, clientViewer]) {
      const shown = items(user);
      expect(shown.filter((i) => i.sample), user.id ?? "").toEqual([]);
      expect(shown.filter((i) => i.rule?.featureReady === false), user.id ?? "").toEqual([]);
      expect(shown.map((i) => i.href)).not.toContain("/portal/status");
      expect(shown.map((i) => i.href)).not.toContain("/portal/roadmap");
    }
  });

  it("hides sample items from DE staff too — only break-glass keeps them (update 3 §3)", () => {
    const shown = items(deStaff);
    expect(shown.filter((i) => i.sample)).toEqual([]);
    expect(shown.filter((i) => i.rule?.featureReady === false)).toEqual([]);
    expect(shown.map((i) => i.href)).not.toContain("/portal/status");
  });
});

describe("update-2 acceptance: the break-glass account reaches everything today", () => {
  it("renders today's menu exactly (every registered legacy item, same sections)", () => {
    const groups = navGroupsFor(breakGlass, SAMPLE_INT, NO_DATA);
    const shown = groups.flatMap((g) => g.items.map((i) => i.href)).sort();
    const legacy = PORTAL_NAV_ITEMS.filter((i) => i.section).map((i) => i.href).sort();
    expect(shown).toEqual(legacy);
    expect(groups.map((g) => g.id)).toEqual(["support", "account", "programs", "tools", "admin"]);
  });

  it("keeps sample badges and is never gated by role, entitlement or data", () => {
    const shown = items(breakGlass, SAMPLE_INT, NO_DATA);
    expect(shown.find((i) => i.href === "/portal/admin/import")?.sample).toBe(true);
    for (const item of PORTAL_NAV_ITEMS.filter((i) => i.section)) {
      expect(isNavAllowed(item, { user: breakGlass, integrations: SAMPLE_INT, navContext: NO_DATA, view: "legacy" }), item.href).toBe(true);
    }
  });

  it("still honours the integration hidden switch (today's behaviour)", () => {
    const shown = items(breakGlass, HIDDEN_INT, NO_DATA).map((i) => i.href);
    expect(shown).not.toContain("/portal/vpn");
    expect(shown).not.toContain("/portal/ship-center");
  });
});

describe("target client menu", () => {
  it("gives a standard user the plan's seven items (Files only when shared)", () => {
    expect(labels(standardUser)).toEqual([
      "Home",
      "Get help",
      "My requests",
      "How-to guides",
      "Desktop agent",
      "My profile",
    ]);
    expect(labels(standardUser, SAMPLE_INT, { entitlements: [], data: { sharedFiles: true, itPlan: false } })).toContain("Files");
  });

  it("adds role items by hat only", () => {
    const approver: PortalUserSession = { ...standardUser, clientRoles: ["approver"] };
    expect(labels(approver)).toContain("Approvals");
    expect(labels(approver)).not.toContain("Billing and contracts");

    const billing: PortalUserSession = { ...standardUser, clientRoles: ["billing"] };
    expect(labels(billing)).toContain("Billing and contracts");
    expect(labels(billing)).not.toContain("Order equipment");

    // The legacy org-role derivation keeps today's IT-contact access intact.
    expect(labels(clientItContact)).toEqual(
      expect.arrayContaining(["Approvals", "People and devices", "Billing and contracts", "Order equipment"]),
    );
  });

  it("gates entitlement items on and off (default off)", () => {
    // A sample-mode integration stays hidden from clients even with the
    // entitlement; the live feature appears when the company holds it.
    expect(labels(standardUser)).not.toContain("Secure access");
    expect(labels(standardUser, SAMPLE_INT, { entitlements: ["cloud_edge"], data: {} })).not.toContain("Secure access");
    expect(labels(standardUser, LIVE_INT, { entitlements: ["cloud_edge"], data: {} })).toContain("Secure access");
    expect(labels(standardUser, LIVE_INT, { entitlements: ["voice"], data: {} })).toContain("Business phone");
    expect(labels(standardUser, LIVE_INT, { entitlements: ["voice"], data: {} })).not.toContain("Secure access");
    // Vendor names never appear in the client menu.
    expect(labels(standardUser, LIVE_INT, { entitlements: ["voice"], data: {} })).not.toContain("Cytracom Phone");
  });

  it("gives DE staff the client menu plus DE-only items and their DE Admin subset", () => {
    const shown = labels(deStaff);
    expect(shown).toEqual(expect.arrayContaining(["Home", "Get help", "Infrastructure Issues", "Structure & IDs", "Companies"]));
    // Samples stay out of the daily DE staff menu (update 3 §3): Ship Center is
    // still in sample mode here, and DE Questionnaires never left it. System Status
    // is real now but lives in the Get help hub, not as its own menu entry.
    expect(shown).not.toContain("Ship Center");
    expect(shown).not.toContain("System Status");
    // DE Questionnaires is real now (lane C) and belongs in the DE staff menu.
    expect(shown).toContain("DE Questionnaires");
    // Break-glass-only surfaces stay out of the daily DE staff menu.
    expect(shown).not.toContain("Login Alerts");
    expect(shown).not.toContain("Data Sources");
    expect(shown).not.toContain("OpenAI Billing");
    expect(shown).not.toContain("Manage Agents");
  });

  it("hides DE-only items from client roles", () => {
    for (const user of [standardUser, clientItContact]) {
      const shown = labels(user, LIVE_INT, {
        entitlements: ["cloud_edge", "voice", "security_awareness"],
        data: { sharedFiles: true, itPlan: true },
      });
      expect(shown, user.id ?? "").not.toContain("Infrastructure Issues");
      expect(shown).not.toContain("Structure & IDs");
      expect(shown).not.toContain("Ship Center");
    }
  });
});

describe("no route is lost: every menu entry stays reachable", () => {
  it("the target menu covers every non-break-glass item via an entry or a hub", () => {
    const covered = new Set<string>([
      ...PORTAL_NAV_ITEMS.filter((i) => i.target).map((i) => i.href),
      ...Object.values(PORTAL_NAV_HUBS).flat(),
    ]);
    for (const item of PORTAL_NAV_ITEMS) {
      if (item.rule?.superAdminOnly) continue; // break-glass menu covers these
      expect(covered.has(item.href), item.href).toBe(true);
    }
  });
});

describe("route guard (hidden route → Home with a note)", () => {
  it("resolves merged routes to their hub in the target menu", () => {
    expect(findNavItem("/portal/roadmap", "target")?.item.href).toBe("/portal/it-plan");
    expect(findNavItem("/portal/tickets/new", "target")?.item.href).toBe("/portal/help");
    expect(findNavItem("/portal/invoices", "target")?.item.href).toBe("/portal/billing-contracts");
    // Legacy (break-glass) view still resolves the route's own item.
    expect(findNavItem("/portal/roadmap", "legacy")?.item.href).toBe("/portal/roadmap");
  });

  it("denies a client the route behind a hidden item and allows the menu's own routes", () => {
    const ctx = { integrations: SAMPLE_INT, navContext: NO_DATA, view: "target" as const };
    // The IT plan hub is real now (lane C): owners only, once the company has a roadmap.
    const roadmapOwner = findNavItem("/portal/roadmap", "target")!.item;
    expect(isNavAllowed(roadmapOwner, { ...ctx, user: standardUser })).toBe(false);
    expect(isNavAllowed(roadmapOwner, { ...ctx, user: deStaff })).toBe(true);
    // Update 3 §3: unfinished features are hidden from DE staff too — only the
    // break-glass account still reaches them.
    const shipCenter = findNavItem("/portal/ship-center", "legacy")!.item;
    expect(isNavAllowed(shipCenter, { ...ctx, user: deStaff })).toBe(false);

    const infraOwner = findNavItem("/portal/infrastructure", "target")!.item;
    expect(isNavAllowed(infraOwner, { ...ctx, user: clientItContact })).toBe(false);
    expect(isNavAllowed(infraOwner, { ...ctx, user: deStaff })).toBe(true);

    const homeOwner = findNavItem("/portal/dashboard", "target")!.item;
    expect(isNavAllowed(homeOwner, { ...ctx, user: standardUser })).toBe(true);
    // The break-glass account is never redirected away.
    expect(isNavAllowed(roadmapOwner, { ...ctx, user: breakGlass, view: "legacy" })).toBe(true);
  });
});

describe("System Status (real, in the Get help hub)", () => {
  const ctx = { integrations: SAMPLE_INT, navContext: NO_DATA, view: "target" as const };

  it("lets every client role open the status page, which folds into Get help", () => {
    const status = findNavItem("/portal/status", "legacy")!.item;
    expect(status.sample).toBeFalsy();
    for (const user of [standardUser, clientItContact, clientViewer, deStaff]) {
      expect(isNavAllowed(status, { ...ctx, user }), user.id ?? "").toBe(true);
    }
    expect(findNavItem("/portal/status", "target")?.item.href).toBe("/portal/help");
    expect(PORTAL_NAV_HUBS["/portal/help"]).toContain("/portal/status");
  });

  it("gives Status notices to DE staff only", () => {
    const admin = findNavItem("/portal/admin/status", "legacy")!.item;
    expect(isNavAllowed(admin, { ...ctx, user: deStaff })).toBe(true);
    for (const user of [standardUser, clientItContact, clientViewer]) {
      expect(isNavAllowed(admin, { ...ctx, user }), user.id ?? "").toBe(false);
    }
  });
});

describe("IT Roadmap (real, owners, in the IT plan hub)", () => {
  const owner: PortalUserSession = { ...standardUser, clientRoles: ["owner"] };
  const withPlan = { entitlements: [], data: { sharedFiles: false, itPlan: true } };

  it("shows IT plan and reviews to owners once the company has a roadmap, never to standard users", () => {
    expect(labels(owner, SAMPLE_INT, NO_DATA)).not.toContain("IT plan and reviews");
    expect(labels(owner, SAMPLE_INT, withPlan)).toContain("IT plan and reviews");
    expect(labels(standardUser, SAMPLE_INT, withPlan)).not.toContain("IT plan and reviews");
  });

  it("lets owners open the roadmap and Business Reviews pages, not standard users", () => {
    const roadmap = findNavItem("/portal/roadmap", "legacy")!.item;
    const qbr = findNavItem("/portal/qbr", "legacy")!.item;
    const ctx = { integrations: SAMPLE_INT, navContext: withPlan, view: "target" as const };
    expect(isNavAllowed(roadmap, { ...ctx, user: owner })).toBe(true);
    expect(isNavAllowed(roadmap, { ...ctx, user: standardUser })).toBe(false);
    expect(isNavAllowed(qbr, { ...ctx, user: owner })).toBe(true);
    expect(isNavAllowed(qbr, { ...ctx, user: standardUser })).toBe(false);
  });

  it("gives Roadmaps and Business reviews (DE Admin) to DE staff only", () => {
    const ctx = { integrations: SAMPLE_INT, navContext: NO_DATA, view: "target" as const };
    for (const href of ["/portal/admin/roadmap", "/portal/admin/business-reviews"]) {
      const admin = findNavItem(href, "legacy")!.item;
      expect(isNavAllowed(admin, { ...ctx, user: deStaff }), href).toBe(true);
      for (const user of [standardUser, clientItContact, owner]) expect(isNavAllowed(admin, { ...ctx, user }), href).toBe(false);
    }
  });
});

describe("DE Questionnaires (real, lane C)", () => {
  it("gives every client role My questionnaires inside Home, and the assign page to DE staff only", () => {
    const ctx = { integrations: SAMPLE_INT, navContext: NO_DATA, view: "target" as const };
    const mine = findNavItem("/portal/my-questionnaires", "legacy")!.item;
    const de = findNavItem("/portal/questionnaires", "legacy")!.item;
    for (const user of [standardUser, clientItContact, clientViewer, deStaff]) expect(isNavAllowed(mine, { ...ctx, user }), user.id ?? "").toBe(true);
    expect(findNavItem("/portal/my-questionnaires", "target")?.item.href).toBe("/portal/dashboard");
    expect(isNavAllowed(de, { ...ctx, user: deStaff })).toBe(true);
    for (const user of [standardUser, clientItContact, clientViewer]) expect(isNavAllowed(de, { ...ctx, user }), user.id ?? "").toBe(false);
  });
});
