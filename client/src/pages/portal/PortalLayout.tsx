import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Ticket,
  Package,
  FileText,
  BookOpen,
  Settings,
  Activity,
  GraduationCap,
  MessageCircle,
  Download,
  Truck,
  ShoppingCart,
  ClipboardList,
  CheckSquare,
  FileStack,
  Upload,
  Users,
  Calendar,
  Shield,
  Phone,
  Building2,
  FileSignature,
  FilePlus,
  Map,
  BarChart3,
  AlertTriangle,
  Briefcase,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import logoImage from "@assets/DE-Logo-new_1762461524794.webp";
import { TenantSelector } from "@/components/portal/TenantSelector";
import { useSEO } from "@/hooks/useSEO";
import { navAllowed, readImpersonatingCompany, readPortalUser, type NavKey } from "@/lib/portalRoles";
import { portalGet, redirectToPortalLogin } from "@/lib/portalApi";
import { usePortalHubEvents } from "@/hooks/usePortalHubEvents";

interface PortalLayoutProps {
  children: React.ReactNode;
  title: string;
}

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  key: NavKey;
};

const navItems: NavItem[] = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/portal/tickets", label: "Support Tickets", icon: Ticket, key: "tickets" },
  { href: "/portal/forms", label: "Request Forms", icon: ClipboardList, key: "forms" },
  { href: "/portal/infrastructure", label: "Infrastructure Issues", icon: AlertTriangle, key: "infrastructure" },
  { href: "/portal/chat", label: "Chats / DE Desk", icon: MessageCircle, key: "chat" },
  { href: "/portal/approvals", label: "Approvals", icon: FileStack, key: "approvals" },
  { href: "/portal/people", label: "People & Org", icon: Users, key: "people" },
  { href: "/portal/questionnaires", label: "DE Questionnaires", icon: Calendar, key: "other" },
  { href: "/portal/surveys", label: "Surveys", icon: CheckSquare, key: "surveys" },
  { href: "/portal/contracts", label: "Contracts", icon: FileSignature, key: "contracts" },
  { href: "/portal/order-form", label: "New Order", icon: FilePlus, key: "other" },
  { href: "/portal/services", label: "My Services", icon: Package, key: "services" },
  { href: "/portal/billing", label: "Billing", icon: FileText, key: "billing" },
  { href: "/portal/company", label: "Company", icon: Building2, key: "company" },
  { href: "/portal/files", label: "Files & Downloads", icon: FileText, key: "files" },
  { href: "/portal/invoices", label: "Invoices", icon: FileText, key: "billing" },
  { href: "/portal/orders", label: "Orders", icon: ShoppingCart, key: "other" },
  { href: "/portal/vpn", label: "VPN Access", icon: Shield, key: "other" },
  { href: "/portal/cytracom", label: "Cytracom Phone", icon: Phone, key: "other" },
  { href: "/portal/ship-center", label: "Ship Center", icon: Truck, key: "other" },
  { href: "/portal/marketplace", label: "Client Marketplace", icon: ShoppingCart, key: "other" },
  { href: "/portal/procurement", label: "Procurement Store", icon: ShoppingCart, key: "other" },
  { href: "/portal/roadmap", label: "IT Roadmap", icon: Map, key: "other" },
  { href: "/portal/qbr", label: "Business Reviews", icon: BarChart3, key: "other" },
  { href: "/portal/kb", label: "Knowledge Base", icon: BookOpen, key: "kb" },
  { href: "/portal/status", label: "System Status", icon: Activity, key: "other" },
  { href: "/portal/learning", label: "Learning", icon: GraduationCap, key: "learning" },
  { href: "/portal/agent", label: "Desktop Agent", icon: Download, key: "other" },
  { href: "/portal/settings", label: "Settings", icon: Settings, key: "settings" },
];

const adminItems = [
  { href: "/portal/admin/companies", label: "Companies", icon: Building2 },
  { href: "/portal/admin/login-knocks", label: "Login Alerts", icon: Shield },
  { href: "/portal/admin/lifecycle", label: "Onboard / Offboard", icon: Users },
  { href: "/portal/admin/contracts", label: "Contracts", icon: FileSignature },
  { href: "/portal/admin/import", label: "Data Import", icon: Upload },
  { href: "/portal/admin/agents", label: "Manage Agents", icon: Download },
  { href: "/portal/admin/openai", label: "OpenAI Billing", icon: Settings },
  { href: "/portal/sales-process", label: "Sales Process", icon: Briefcase },
];

/** Sidebar link styles for dark navy rail — avoid accent/pink Button hover bleed. */
const navLinkBase =
  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors";
const navLinkIdle =
  "text-white/70 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/60";
const navLinkActive = "bg-[#D3126A] text-white hover:bg-[#e01874] hover:text-white";
const sidebarGhostBtn =
  "text-white/70 hover:!bg-white/15 hover:!text-white focus-visible:ring-[#D3126A]";

export function PortalLayout({ children, title }: PortalLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  usePortalHubEvents();
  useSEO({
    title: `${title} | Client Portal`,
    description: "Digerati Experts Client Portal — secure access for existing clients.",
    noIndex: true,
  });
  const [user, setUser] = useState(() => readPortalUser());
  const impersonatingCompany = readImpersonatingCompany();

  // Ensure session is real: Bearer localStorage and/or httpOnly portalAuth cookie
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await portalGet<{ user: any }>("/api/portal/me");
        if (cancelled) return;
        if (me?.user) {
          localStorage.setItem("portalUser", JSON.stringify(me.user));
          localStorage.setItem("portalUserId", me.user.id || "portal-user");
          if (me.user.email) localStorage.setItem("userEmail", me.user.email);
          setUser(me.user);
        }
        setSessionReady(true);
      } catch (err) {
        if (cancelled) return;
        // Only a genuine auth rejection ends the session. A 500 or a network
        // blip must NOT log the user out mid-work (error-sweep finding,
        // 2026-08-31) — portalGet throws Error("<status>: <body>").
        const message = err instanceof Error ? err.message : "";
        const status = Number.parseInt(message.split(":")[0] ?? "", 10);
        if (status === 401 || status === 403) {
          redirectToPortalLogin(
            `${window.location.pathname}${window.location.search || ""}`,
          );
        } else {
          // Keep whatever session state we have; the page's own data calls
          // will surface real errors.
          setSessionReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleNav = useMemo(
    () => navItems.filter((item) => navAllowed(user, item.key)),
    [user?.id, user?.orgRole, user?.role, user?.isCompanyItContact],
  );

  const handleStopImpersonation = async () => {
    try {
      const token = localStorage.getItem("portalToken");
      const response = await fetch("/api/portal/admin/stop-impersonation", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("portalToken", data.token);
        localStorage.removeItem("impersonatingCompany");
        window.location.href = "/portal/admin/companies";
      }
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
    } catch {
      /* still clear local */
    }
    localStorage.removeItem("portalUser");
    localStorage.removeItem("portalToken");
    localStorage.removeItem("portalUserId");
    localStorage.removeItem("impersonatingCompany");
    window.location.href = "/portal/login";
  };

  if (!sessionReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950 text-sm text-slate-500">
        Checking session…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-[#030228] to-[#0f0d2e] border-r border-white/10 transform transition-transform duration-200 ease-in-out z-50 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/10">
            <img src={logoImage} alt="Digerati Experts" className="h-8 w-auto" />
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              // Avoid /portal/orders stealing active from /portal/order-form (and similar prefixes).
              const isActive =
                location === item.href ||
                (item.href !== "/portal/orders" && location.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${navLinkBase} ${isActive ? navLinkActive : navLinkIdle}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}

            {user?.role === "admin" && (
              <>
                <Separator className="my-4 bg-white/10" />
                <p className="px-3 text-xs uppercase tracking-wide text-white/40">Admin</p>
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location === item.href || location.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${navLinkBase} ${isActive ? navLinkActive : navLinkIdle}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-white/10">
            <Button
              variant="ghost"
              className={`w-full justify-start ${sidebarGhostBtn}`}
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-[#030228] text-white">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={`md:hidden ${sidebarGhostBtn}`}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === "admin" && (
              <TenantSelector currentTenant={impersonatingCompany ? { id: impersonatingCompany.id ?? "", companyName: impersonatingCompany.companyName ?? "" } : null} />
            )}
            {impersonatingCompany && (
              <Button size="sm" variant="secondary" onClick={handleStopImpersonation}>
                Exit {impersonatingCompany?.companyName || "company"}
              </Button>
            )}
            <span className="text-sm text-white/70 hidden sm:inline">
              Welcome, {user?.fullName?.split(" ")[0] || user?.email || "user"}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
