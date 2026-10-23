import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Cable,
  Calendar,
  CheckSquare,
  ClipboardList,
  Download,
  FilePlus,
  FileSignature,
  FileStack,
  FileText,
  FolderOpen,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Map,
  MessageCircle,
  Network,
  Package,
  Phone,
  Plug,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Store,
  Ticket,
  Truck,
  Upload,
  Users,
  Warehouse,
} from "lucide-react";
import { navAllowed, type NavKey, type PortalUserSession } from "@/lib/portalRoles";
import type { IntegrationArea, IntegrationMap } from "@/lib/portalIntegrations";
import {
  accountClassOf,
  ruleAllows,
  type AccessRule,
  type ClientRole,
  type EntitlementKey,
  type NavDataKey,
} from "@shared/permissions";

/**
 * The portal navigation registry (lane A). ONE registry — Wave 2 lanes edit only
 * their own items' lines here (docs/lanes/registry.md). Each item carries:
 *   - its route and today's label/icon/section (the break-glass menu is rendered
 *     from these exactly as it ships today),
 *   - `rule`: the one visibility rule (roles / entitlement / featureReady /
 *     sample / deOnly / superAdminOnly / requiresData) evaluated by
 *     shared/permissions ruleAllows(),
 *   - `target`: its place in the plan's target client menu (Phase 2), including
 *     renames and hub merges,
 *   - `children`: for hub items, the merged member routes.
 * No route is ever removed: hidden routes still work and redirect to Home with a
 * short note (PortalLayout).
 */

export type PortalSectionId = "support" | "account" | "programs" | "tools" | "admin";
export type PortalTargetGroupId = "portal" | "manage" | "services" | "de" | "admin";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  key: NavKey;
  /** Short verb phrase for the command palette. */
  hint?: string;
  /** Page shows sample content until its backend is live (Tier 0 truth). */
  sample?: boolean;
  /** Match only the exact path, never children (e.g. /portal/orders vs /portal/order-form). */
  exact?: boolean;
  /** Data source switch (server/portalIntegrations.ts): hidden drops the item, live clears `sample`. */
  integration?: IntegrationArea;
  /** The one visibility rule for this item (shared/permissions). */
  rule?: AccessRule;
  /** Today's menu group. The break-glass account's menu is this grouping, unchanged. */
  section?: PortalSectionId;
  /** Target client menu placement (plan Phase 2). Absent = merged into a hub or not in the client menu. */
  target?: {
    group: PortalTargetGroupId;
    label: string;
    order: number;
    /** This item folds into the hub at this href instead of appearing as its own entry. */
    hub?: string;
  };
  /** Hub items only: the merged member hrefs (each still a working route). */
  children?: string[];
};

export type PortalNavGroup = {
  id: string;
  label: string;
  items: PortalNavItem[];
};

/** What the server reports about the acting company (GET /api/portal/me → navContext). */
export type PortalNavContext = {
  entitlements?: EntitlementKey[] | null;
  data?: Partial<Record<NavDataKey, boolean>> | null;
};

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  // ── Support (today's group; unchanged for the break-glass account) ──
  {
    href: "/portal/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    key: "dashboard",
    hint: "Overview of what needs you",
    section: "support",
    rule: { featureReady: true },
    target: { group: "portal", label: "Home", order: 1 },
    children: ["/portal/self-service", "/portal/surveys"],
  },
  {
    href: "/portal/self-service",
    label: "Self-Service",
    icon: LayoutGrid,
    key: "requests",
    hint: "Start a request, fix an issue, find an answer",
    section: "support",
    rule: { featureReady: true },
  },
  {
    href: "/portal/tickets",
    label: "Support Tickets",
    icon: Ticket,
    key: "tickets",
    hint: "Open, track and reply",
    section: "support",
    rule: { featureReady: true },
  },
  {
    href: "/portal/forms",
    label: "Request Forms",
    icon: ClipboardList,
    key: "forms",
    hint: "Access, devices, onboarding",
    section: "support",
    rule: { featureReady: true },
  },
  {
    href: "/portal/requests",
    label: "Service Requests",
    icon: Package,
    key: "requests",
    hint: "Loaner and return computers, licences, my requests",
    section: "support",
    rule: { featureReady: true },
    target: { group: "portal", label: "My requests", order: 3 },
  },
  {
    href: "/portal/licensing",
    label: "Licenses",
    icon: KeyRound,
    key: "requests",
    hint: "Licence policy, account types, request a licence",
    section: "support",
    rule: { featureReady: true },
  },
  {
    href: "/portal/infrastructure",
    label: "Infrastructure Issues",
    icon: AlertTriangle,
    key: "infrastructure",
    hint: "Report an outage or fault",
    section: "support",
    rule: { deOnly: true, featureReady: true },
    target: { group: "de", label: "Infrastructure Issues", order: 1 },
  },
  {
    href: "/portal/chat",
    label: "Chats / DE Desk",
    icon: MessageCircle,
    key: "chat",
    hint: "Live chat and website desk",
    section: "support",
    rule: { featureReady: true },
  },
  {
    href: "/portal/approvals",
    label: "Approvals",
    icon: FileStack,
    key: "approvals",
    hint: "Decide pending requests",
    section: "support",
    rule: { roles: ["approver" as ClientRole], featureReady: true },
    target: { group: "manage", label: "Approvals", order: 1 },
  },
  {
    href: "/portal/kb",
    label: "Knowledge Base",
    icon: BookOpen,
    key: "kb",
    hint: "How-to articles",
    section: "support",
    rule: { featureReady: true },
    target: { group: "portal", label: "How-to guides", order: 5 },
  },

  // ── Account ──
  {
    href: "/portal/company",
    label: "Company",
    icon: Building2,
    key: "company",
    hint: "Your account record",
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/people",
    label: "People & Org",
    icon: Users,
    key: "people",
    hint: "Departments, roles, managers",
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/organization",
    label: "Structure & IDs",
    icon: Network,
    key: "requests",
    hint: "Site or department leaders, VIPs, people IDs",
    section: "account",
    rule: { deOnly: true, featureReady: true },
    target: { group: "de", label: "Structure & IDs", order: 2 },
  },
  {
    href: "/portal/representation",
    label: "My Groups",
    icon: Users,
    key: "requests",
    hint: "Groups you represent and their requests",
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/contracts",
    label: "Contracts",
    icon: FileSignature,
    key: "contracts",
    hint: "Agreements and documents",
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/files",
    label: "Files & Downloads",
    icon: FolderOpen,
    key: "files",
    hint: "Files DE shared with you",
    section: "account",
    rule: { requiresData: "sharedFiles", featureReady: true },
    target: { group: "portal", label: "Files", order: 4 },
  },
  {
    href: "/portal/billing",
    label: "Billing",
    icon: Receipt,
    key: "billing",
    hint: "Subscription and payments",
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/invoices",
    label: "Invoices",
    icon: FileText,
    key: "billing",
    hint: "View and pay invoices",
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/services",
    label: "My Services",
    icon: Package,
    key: "services",
    hint: "What you subscribe to",
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/orders",
    label: "Orders",
    icon: ShoppingCart,
    key: "other",
    hint: "Order history",
    exact: true,
    section: "account",
    rule: { featureReady: true },
  },
  {
    href: "/portal/order-form",
    label: "New Order",
    icon: FilePlus,
    key: "other",
    hint: "Order services",
    section: "account",
    rule: { featureReady: true },
  },

  // ── Programs ──
  {
    href: "/portal/questionnaires",
    label: "DE Questionnaires",
    icon: Calendar,
    key: "other",
    hint: "Scheduled reviews",
    sample: true,
    section: "programs",
    rule: { deOnly: true, sample: true, featureReady: false },
    target: { group: "de", label: "DE Questionnaires", order: 5 },
  },
  {
    href: "/portal/surveys",
    label: "Surveys",
    icon: CheckSquare,
    key: "surveys",
    hint: "Tell us how we did",
    section: "programs",
    rule: { featureReady: true },
  },
  {
    href: "/portal/roadmap",
    label: "IT Roadmap",
    icon: Map,
    key: "other",
    hint: "Strategic plan",
    section: "programs",
    // Owners read, comment and approve (shared/permissions/lane-c.ts roadmap.read).
    rule: { roles: ["owner" as ClientRole], featureReady: true },
  },
  {
    href: "/portal/qbr",
    label: "Business Reviews",
    icon: BarChart3,
    key: "other",
    hint: "Quarterly reviews",
    sample: true,
    section: "programs",
    rule: { sample: true, featureReady: false },
  },
  {
    href: "/portal/learning",
    label: "Learning",
    icon: GraduationCap,
    key: "learning",
    hint: "Security awareness",
    section: "programs",
    rule: { entitlement: "security_awareness", featureReady: true },
    target: { group: "services", label: "Security training", order: 3 },
  },
  {
    href: "/portal/status",
    label: "System Status",
    icon: Activity,
    key: "other",
    hint: "Incidents and maintenance",
    section: "programs",
    // Every signed-in user may open it: from the status line on Home and from
    // the Get help hub, not as its own menu entry (lane-d-status-shipping.md).
    // DE staff post notices from DE Admin → Status notices.
    rule: { featureReady: true },
    target: { group: "portal", label: "Service status", order: 2, hub: "/portal/help" },
  },

  // ── Tools ──
  {
    href: "/portal/vpn",
    label: "VPN Access",
    icon: Shield,
    key: "other",
    hint: "Remote access profiles",
    sample: true,
    integration: "vpn",
    section: "tools",
    rule: { entitlement: "cloud_edge", featureReady: true },
    target: { group: "services", label: "Secure access", order: 1 },
  },
  {
    href: "/portal/cytracom",
    label: "Cytracom Phone",
    icon: Phone,
    key: "other",
    hint: "Phone system",
    sample: true,
    integration: "phone",
    section: "tools",
    rule: { entitlement: "voice", featureReady: true },
    target: { group: "services", label: "Business phone", order: 2 },
  },
  {
    href: "/portal/ship-center",
    label: "Ship Center",
    icon: Truck,
    key: "other",
    hint: "Shipments",
    sample: true,
    integration: "shipping",
    section: "tools",
    rule: { deOnly: true, featureReady: true },
    target: { group: "de", label: "Ship Center", order: 3 },
  },
  {
    href: "/portal/marketplace",
    label: "Client Marketplace",
    icon: ShoppingBag,
    key: "other",
    hint: "Approved products",
    section: "tools",
    rule: { featureReady: true },
  },
  {
    href: "/portal/procurement",
    label: "Procurement Store",
    icon: Store,
    key: "other",
    hint: "Distributor links",
    section: "tools",
    rule: { featureReady: true },
  },
  {
    href: "/portal/agent",
    label: "Desktop Agent",
    icon: Download,
    key: "other",
    hint: "Install the DE agent",
    section: "tools",
    rule: { featureReady: true },
    target: { group: "portal", label: "Desktop agent", order: 6 },
  },
  {
    href: "/portal/settings",
    label: "Settings",
    icon: Settings,
    key: "settings",
    hint: "Profile, password, MFA",
    section: "tools",
    rule: { featureReady: true },
    target: { group: "portal", label: "My profile", order: 7 },
  },

  // ── Target-menu hubs (merged routes; not part of today's menu) ──
  {
    href: "/portal/help",
    label: "Get help",
    icon: LifeBuoy,
    key: "other",
    hint: "Tickets, DE Desk chat and request forms",
    rule: { featureReady: true },
    target: { group: "portal", label: "Get help", order: 2 },
    children: ["/portal/tickets", "/portal/chat", "/portal/forms", "/portal/status"],
  },
  {
    href: "/portal/people-devices",
    label: "People and devices",
    icon: Users,
    key: "other",
    hint: "People, groups, company record, licences and services",
    rule: { roles: ["client_admin" as ClientRole], featureReady: true },
    target: { group: "manage", label: "People and devices", order: 2 },
    children: ["/portal/people", "/portal/representation", "/portal/company", "/portal/licensing", "/portal/services"],
  },
  {
    href: "/portal/billing-contracts",
    label: "Billing and contracts",
    icon: Receipt,
    key: "other",
    hint: "Billing, invoices and agreements",
    rule: { roles: ["billing" as ClientRole], featureReady: true },
    target: { group: "manage", label: "Billing and contracts", order: 3 },
    children: ["/portal/billing", "/portal/invoices", "/portal/contracts"],
  },
  {
    href: "/portal/order-equipment",
    label: "Order equipment",
    icon: ShoppingBag,
    key: "other",
    hint: "Orders, marketplace and procurement",
    rule: { roles: ["purchaser" as ClientRole], featureReady: true },
    target: { group: "manage", label: "Order equipment", order: 4 },
    children: ["/portal/orders", "/portal/order-form", "/portal/marketplace", "/portal/procurement"],
  },
  {
    href: "/portal/it-plan",
    label: "IT plan and reviews",
    icon: Map,
    key: "other",
    hint: "Roadmap and business reviews",
    // Appears once DE has written a roadmap for the company (navContext.data.itPlan).
    rule: { roles: ["owner" as ClientRole], featureReady: true, requiresData: "itPlan" },
    target: { group: "manage", label: "IT plan and reviews", order: 5 },
    children: ["/portal/roadmap", "/portal/qbr"],
  },

  // ── DE Admin (today's group; two items stay break-glass-only, unchanged) ──
  {
    href: "/internal/warehouse",
    label: "Digital Warehouse",
    icon: Warehouse,
    key: "other",
    hint: "Staff ops · SKUs · Hub feed",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Digital Warehouse", order: 1 },
  },
  {
    href: "/portal/admin/companies",
    label: "Companies",
    icon: Building2,
    key: "other",
    hint: "Tenants and impersonation",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Companies", order: 2 },
  },
  {
    href: "/portal/admin/license-board",
    label: "License Patch Bay",
    icon: Cable,
    key: "other",
    hint: "Patch vendor licences to companies and people",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "License Patch Bay", order: 3 },
  },
  {
    href: "/portal/admin/login-knocks",
    label: "Login Alerts",
    icon: Shield,
    key: "other",
    hint: "Door knocks",
    section: "admin",
    rule: { superAdminOnly: true, featureReady: true },
  },
  {
    href: "/portal/admin/lifecycle",
    label: "Onboard / Offboard",
    icon: Users,
    key: "other",
    hint: "JumpCloud identity lifecycle",
    section: "admin",
    rule: { superAdminOnly: true, featureReady: true },
  },
  {
    href: "/portal/admin/contracts",
    label: "Contracts",
    icon: FileSignature,
    key: "other",
    hint: "Send and countersign",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Contracts", order: 4 },
  },
  {
    href: "/portal/admin/status",
    label: "Status Notices",
    icon: Activity,
    key: "other",
    hint: "Post incidents and maintenance",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Status notices", order: 8 },
  },
  {
    href: "/portal/admin/roadmap",
    label: "Roadmaps",
    icon: Map,
    key: "other",
    hint: "Write client IT roadmaps",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Roadmaps", order: 9 },
  },
  {
    href: "/portal/admin/data-sources",
    label: "Data Sources",
    icon: Plug,
    key: "other",
    hint: "VPN, phone, shipping setup",
    section: "admin",
    rule: { superAdminOnly: true, featureReady: true },
  },
  {
    href: "/portal/admin/import",
    label: "Data Import",
    icon: Upload,
    key: "other",
    hint: "External systems",
    sample: true,
    section: "admin",
    rule: { superAdminOnly: true, sample: true, featureReady: false },
  },
  {
    href: "/portal/admin/agents",
    label: "Manage Agents",
    icon: Download,
    key: "other",
    hint: "Endpoint agent release",
    section: "admin",
    rule: { superAdminOnly: true, featureReady: true },
  },
  {
    href: "/portal/admin/openai",
    label: "OpenAI Billing",
    icon: Settings,
    key: "other",
    hint: "Kill switch",
    section: "admin",
    rule: { superAdminOnly: true, featureReady: true },
  },
  {
    href: "/portal/admin/kb",
    label: "Knowledge Authoring",
    icon: BookOpen,
    key: "other",
    hint: "Write and publish KB articles",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Knowledge Authoring", order: 5 },
  },
  {
    href: "/portal/admin/order-requests",
    label: "Order Change Requests",
    icon: Package,
    key: "other",
    hint: "Client cancellations and changes to Store orders",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Order Change Requests", order: 6 },
  },
  {
    href: "/portal/sales-process",
    label: "Sales Process",
    icon: Briefcase,
    key: "other",
    hint: "Internal playbook",
    section: "admin",
    rule: { deOnly: true, featureReady: true },
    target: { group: "admin", label: "Sales Process", order: 7 },
  },
];

const LEGACY_GROUP_ORDER: Array<{ id: PortalSectionId; label: string }> = [
  { id: "support", label: "Support" },
  { id: "account", label: "Account" },
  { id: "programs", label: "Programs" },
  { id: "tools", label: "Tools" },
];

const TARGET_GROUP_ORDER: Array<{ id: PortalTargetGroupId; label: string }> = [
  { id: "portal", label: "Your portal" },
  { id: "manage", label: "Manage" },
  { id: "services", label: "Services" },
  { id: "de", label: "DE work" },
  { id: "admin", label: "DE Admin" },
];

function itemsInSection(section: PortalSectionId): PortalNavItem[] {
  return PORTAL_NAV_ITEMS.filter((item) => item.section === section);
}

/** Today's four client groups, built from the registry (break-glass menu: unchanged). */
export const PORTAL_NAV_GROUPS: PortalNavGroup[] = LEGACY_GROUP_ORDER.map((group) => ({
  id: group.id,
  label: group.label,
  items: itemsInSection(group.id),
}));

export const PORTAL_ADMIN_GROUP: PortalNavGroup = {
  id: "admin",
  label: "DE Admin",
  items: itemsInSection("admin"),
};

/** Hub href → member hrefs (target menu merges). */
export const PORTAL_NAV_HUBS: Record<string, string[]> = Object.fromEntries(
  PORTAL_NAV_ITEMS.filter((item) => item.children?.length).map((item) => [item.href, item.children!]),
);

const CHILD_TO_HUB: Record<string, string> = Object.fromEntries(
  Object.entries(PORTAL_NAV_HUBS).flatMap(([hub, children]) => children.map((href) => [href, hub])),
);

export function hubForHref(href: string): PortalNavItem | null {
  const hubHref = CHILD_TO_HUB[href];
  return hubHref ? PORTAL_NAV_ITEMS.find((item) => item.href === hubHref) ?? null : null;
}

/** Which menu an account renders: the break-glass account keeps today's menu. */
export function navViewFor(user: PortalUserSession | null): "legacy" | "target" {
  return accountClassOf(user) === "super_admin" ? "legacy" : "target";
}

/**
 * The item's effective rule: an integration area that is live makes the feature
 * real (badge cleared, featureReady true); `sample` follows the badge.
 */
function effectiveRule(item: PortalNavItem, integrations?: IntegrationMap): AccessRule {
  const live = item.integration ? integrations?.[item.integration]?.mode === "live" : false;
  return {
    ...item.rule,
    sample: live ? false : item.sample ?? item.rule?.sample ?? false,
    featureReady: live ? true : item.rule?.featureReady ?? true,
  };
}

export type NavEvalContext = {
  user: PortalUserSession | null;
  integrations?: IntegrationMap;
  navContext?: PortalNavContext | null;
  view?: "legacy" | "target";
};

/** The single visibility check used by navGroupsFor and the route guard. */
export function isNavAllowed(item: PortalNavItem, ctx: NavEvalContext): boolean {
  const view = ctx.view ?? navViewFor(ctx.user);
  if (item.integration && ctx.integrations?.[item.integration]?.mode === "hidden") return false;
  if (view === "legacy") {
    // Break-glass menu: exactly today's rules (org-role keys + integration mode).
    return navAllowed(ctx.user, item.key);
  }
  return ruleAllows(effectiveRule(item, ctx.integrations), {
    principal: ctx.user,
    entitlements: ctx.navContext?.entitlements ?? [],
    data: ctx.navContext?.data ?? {},
  });
}

function targetItemsIn(group: PortalTargetGroupId): PortalNavItem[] {
  return PORTAL_NAV_ITEMS.filter((item) => item.target?.group === group && !item.target.hub).sort(
    (a, b) => (a.target?.order ?? 0) - (b.target?.order ?? 0),
  );
}

/**
 * Groups visible to this user, empty groups dropped. `sample` items reach only
 * the break-glass account, with their badge. DE staff and client roles never see
 * one (lane-a-update-3.md §3).
 */
export function navGroupsFor(
  user: PortalUserSession | null,
  integrations?: IntegrationMap,
  navContext?: PortalNavContext | null,
): PortalNavGroup[] {
  const view = navViewFor(user);
  const ctx: NavEvalContext = { user, integrations, navContext, view };

  const build = (items: PortalNavItem[], id: string, label: string): PortalNavGroup => ({
    id,
    label,
    items: items
      .filter((item) => isNavAllowed(item, ctx))
      .map((item) =>
        item.integration && integrations?.[item.integration]?.mode === "live"
          ? { ...item, sample: false }
          : item,
      )
      // The target menu carries the plan's renames (Phase 2: "Rename labels only").
      .map((item) => (view === "target" && item.target ? { ...item, label: item.target.label } : item)),
  });

  const groups: PortalNavGroup[] =
    view === "legacy"
      ? LEGACY_GROUP_ORDER.map((group) => build(itemsInSection(group.id), group.id, group.label))
      : TARGET_GROUP_ORDER.filter((group) => group.id !== "admin").map((group) =>
          build(targetItemsIn(group.id), group.id, group.label),
        );

  const visible = groups.filter((group) => group.items.length > 0);

  const adminItems = itemsInSection("admin").filter((item) => isNavAllowed(item, ctx));
  if (adminItems.length > 0) {
    visible.push({ ...PORTAL_ADMIN_GROUP, items: adminItems });
  }
  return visible;
}

export function isNavItemActive(item: PortalNavItem, location: string): boolean {
  if (location === item.href) return true;
  if (item.exact) return false;
  return location.startsWith(`${item.href}/`);
}

/**
 * The nav item (and its group) that owns a path, for breadcrumbs, titles and the
 * route guard. In the target menu a merged route resolves to its hub.
 */
export function findNavItem(
  location: string,
  view?: "legacy" | "target",
): { group: PortalNavGroup; item: PortalNavItem } | null {
  const resolvedView = view ?? "legacy";
  const targetGroup = (id?: PortalTargetGroupId): PortalNavGroup => {
    const found = TARGET_GROUP_ORDER.find((g) => g.id === id);
    return found ? { id: found.id, label: found.label, items: [] } : PORTAL_ADMIN_GROUP;
  };
  const renamed = (item: PortalNavItem): PortalNavItem =>
    resolvedView === "target" && item.target ? { ...item, label: item.target.label } : item;
  if (resolvedView === "target") {
    // A merged route resolves to the hub that owns it (plan Phase 2 merges).
    for (const item of PORTAL_NAV_ITEMS) {
      if (!isNavItemActive(item, location)) continue;
      const hub = hubForHref(item.href);
      if (hub && !hub.target?.hub) {
        return { group: targetGroup(hub.target?.group), item: renamed(hub) };
      }
    }
  }
  const inView = (item: PortalNavItem): boolean =>
    resolvedView === "legacy"
      ? Boolean(item.section)
      : Boolean(item.target) && !item.target!.hub;
  let best: { group: PortalNavGroup; item: PortalNavItem } | null = null;
  for (const group of [...PORTAL_NAV_GROUPS, PORTAL_ADMIN_GROUP]) {
    for (const item of group.items) {
      if (!inView(item)) continue;
      if (!isNavItemActive(item, location)) continue;
      if (!best || item.href.length > best.item.href.length) {
        best = {
          group: resolvedView === "target" ? targetGroup(item.target?.group) : group,
          item: renamed(item),
        };
      }
    }
  }
  return best;
}
