import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
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
  LayoutDashboard,
  Map,
  MessageCircle,
  Package,
  Phone,
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
};

export type PortalNavGroup = {
  id: string;
  label: string;
  items: PortalNavItem[];
};

/**
 * Every href, label and role key below is the same as the flat list the
 * previous shell shipped (PortalLayout navItems / adminItems), regrouped.
 * Removing or renaming a route is not a shell decision: see
 * design/DESIGN-AUTHORITY.md Tier 0 functional preservation.
 */
export const PORTAL_NAV_GROUPS: PortalNavGroup[] = [
  {
    id: "support",
    label: "Support",
    items: [
      { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "dashboard", hint: "Overview of what needs you" },
      { href: "/portal/tickets", label: "Support Tickets", icon: Ticket, key: "tickets", hint: "Open, track and reply" },
      { href: "/portal/forms", label: "Request Forms", icon: ClipboardList, key: "forms", hint: "Access, devices, onboarding" },
      { href: "/portal/infrastructure", label: "Infrastructure Issues", icon: AlertTriangle, key: "infrastructure", hint: "Report an outage or fault" },
      { href: "/portal/chat", label: "Chats / DE Desk", icon: MessageCircle, key: "chat", hint: "Live chat and website desk" },
      { href: "/portal/approvals", label: "Approvals", icon: FileStack, key: "approvals", hint: "Decide pending requests" },
      { href: "/portal/kb", label: "Knowledge Base", icon: BookOpen, key: "kb", hint: "How-to articles" },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { href: "/portal/company", label: "Company", icon: Building2, key: "company", hint: "Your account record" },
      { href: "/portal/people", label: "People & Org", icon: Users, key: "people", hint: "Departments, roles, managers" },
      { href: "/portal/contracts", label: "Contracts", icon: FileSignature, key: "contracts", hint: "Agreements and documents" },
      { href: "/portal/files", label: "Files & Downloads", icon: FolderOpen, key: "files", hint: "Files DE shared with you" },
      { href: "/portal/billing", label: "Billing", icon: Receipt, key: "billing", hint: "Subscription and payments" },
      { href: "/portal/invoices", label: "Invoices", icon: FileText, key: "billing", hint: "View and pay invoices" },
      { href: "/portal/services", label: "My Services", icon: Package, key: "services", hint: "What you subscribe to" },
      { href: "/portal/orders", label: "Orders", icon: ShoppingCart, key: "other", hint: "Order history", exact: true },
      { href: "/portal/order-form", label: "New Order", icon: FilePlus, key: "other", hint: "Order services" },
    ],
  },
  {
    id: "programs",
    label: "Programs",
    items: [
      { href: "/portal/questionnaires", label: "DE Questionnaires", icon: Calendar, key: "other", hint: "Scheduled reviews", sample: true },
      { href: "/portal/surveys", label: "Surveys", icon: CheckSquare, key: "surveys", hint: "Tell us how we did" },
      { href: "/portal/roadmap", label: "IT Roadmap", icon: Map, key: "other", hint: "Strategic plan", sample: true },
      { href: "/portal/qbr", label: "Business Reviews", icon: BarChart3, key: "other", hint: "Quarterly reviews", sample: true },
      { href: "/portal/learning", label: "Learning", icon: GraduationCap, key: "learning", hint: "Security awareness" },
      { href: "/portal/status", label: "System Status", icon: Activity, key: "other", hint: "Uptime and incidents", sample: true },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { href: "/portal/vpn", label: "VPN Access", icon: Shield, key: "other", hint: "Remote access profiles", sample: true },
      { href: "/portal/cytracom", label: "Cytracom Phone", icon: Phone, key: "other", hint: "Phone system", sample: true },
      { href: "/portal/ship-center", label: "Ship Center", icon: Truck, key: "other", hint: "Shipments", sample: true },
      { href: "/portal/marketplace", label: "Client Marketplace", icon: ShoppingBag, key: "other", hint: "Approved products" },
      { href: "/portal/procurement", label: "Procurement Store", icon: Store, key: "other", hint: "Distributor links" },
      { href: "/portal/agent", label: "Desktop Agent", icon: Download, key: "other", hint: "Install the DE agent" },
      { href: "/portal/settings", label: "Settings", icon: Settings, key: "settings", hint: "Profile, password, MFA" },
    ],
  },
];

export const PORTAL_ADMIN_GROUP: PortalNavGroup = {
  id: "admin",
  label: "DE Admin",
  items: [
    { href: "/internal/warehouse", label: "Digital Warehouse", icon: Warehouse, key: "other", hint: "Staff store and stock" },
    { href: "/portal/admin/companies", label: "Companies", icon: Building2, key: "other", hint: "Tenants and impersonation" },
    { href: "/portal/admin/login-knocks", label: "Login Alerts", icon: Shield, key: "other", hint: "Door knocks" },
    { href: "/portal/admin/lifecycle", label: "Onboard / Offboard", icon: Users, key: "other", hint: "JumpCloud identity lifecycle" },
    { href: "/portal/admin/contracts", label: "Contracts", icon: FileSignature, key: "other", hint: "Send and countersign" },
    { href: "/portal/admin/import", label: "Data Import", icon: Upload, key: "other", hint: "External systems", sample: true },
    { href: "/portal/admin/agents", label: "Manage Agents", icon: Download, key: "other", hint: "Desktop agents", sample: true },
    { href: "/portal/admin/openai", label: "OpenAI Billing", icon: Settings, key: "other", hint: "Kill switch" },
    { href: "/portal/sales-process", label: "Sales Process", icon: Briefcase, key: "other", hint: "Internal playbook" },
  ],
};

export function isNavItemActive(item: PortalNavItem, location: string): boolean {
  if (location === item.href) return true;
  if (item.exact) return false;
  return location.startsWith(`${item.href}/`);
}

/** Groups visible to this user, admin group appended for DE admins. */
export function navGroupsFor(user: PortalUserSession | null): PortalNavGroup[] {
  const groups = PORTAL_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => navAllowed(user, item.key)),
  })).filter((group) => group.items.length > 0);
  if (user?.role === "admin") groups.push(PORTAL_ADMIN_GROUP);
  return groups;
}

/** The nav item (and its group) that owns a path, for breadcrumbs and titles. */
export function findNavItem(location: string): { group: PortalNavGroup; item: PortalNavItem } | null {
  const all = [...PORTAL_NAV_GROUPS, PORTAL_ADMIN_GROUP];
  let best: { group: PortalNavGroup; item: PortalNavItem } | null = null;
  for (const group of all) {
    for (const item of group.items) {
      if (!isNavItemActive(item, location)) continue;
      if (!best || item.href.length > best.item.href.length) best = { group, item };
    }
  }
  return best;
}
