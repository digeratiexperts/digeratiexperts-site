import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, Search } from "lucide-react";
import "@/styles/portal.css";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DE_LOGO_REVERSE, DE_MARK } from "@/lib/brandAssets";
import { TenantSelector } from "@/components/portal/TenantSelector";
import { useSEO } from "@/hooks/useSEO";
import { readImpersonatingCompany, type PortalUserSession } from "@/lib/portalRoles";
import { usePortalHubEvents } from "@/hooks/usePortalHubEvents";
import { cn } from "@/lib/utils";
import { findNavItem, isNavItemActive, navGroupsFor } from "@/components/portal/shell/portalNav";
import { usePortalIntegrations } from "@/lib/portalIntegrations";
import { resetPortalSession, usePortalSession } from "@/components/portal/shell/portalSession";
import { usePortalTheme } from "@/components/portal/shell/portalTheme";
import { PortalCommandPalette } from "@/components/portal/shell/PortalCommandPalette";
import { PortalActivityPopover } from "@/components/portal/shell/PortalActivityPopover";
import { PortalUserMenu, initialsOf, roleLabel } from "@/components/portal/shell/PortalUserMenu";
import { PageHeader } from "@/components/portal/ui/PageHeader";
import { Token } from "@/components/portal/ui/PortalStatus";

export interface PortalLayoutProps {
  children: ReactNode;
  /** Page title: browser tab, breadcrumb and (unless `hideHeader`) the page h1. */
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  /** Buttons for the page header's right side. */
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Pages that draw their own title pass true; no second heading is rendered. */
  hideHeader?: boolean;
  /** Content measure. Forms read better narrow; tables want the full width. */
  width?: "narrow" | "default" | "wide" | "full";
  titleTestId?: string;
}

const widthClass: Record<NonNullable<PortalLayoutProps["width"]>, string> = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[1400px]",
  full: "max-w-none",
};

function firstName(user: PortalUserSession | null): string {
  return user?.fullName?.split(" ")[0] || user?.email || "user";
}

export function PortalLayout({
  children,
  title,
  description,
  eyebrow,
  actions,
  backHref,
  backLabel,
  hideHeader = false,
  width = "default",
  titleTestId,
}: PortalLayoutProps) {
  const [location] = useLocation();
  const { ready, user } = usePortalSession();
  const [theme, themePreference, setThemePreference] = usePortalTheme();
  // Portalled overlays (dialogs, menus, popovers) render into <body>; give
  // <body> the portal token scope while a portal page is mounted.
  useEffect(() => {
    const body = document.body;
    body.classList.add("de-portal-scope");
    body.dataset.portalTheme = theme;
    return () => {
      body.classList.remove("de-portal-scope");
      delete body.dataset.portalTheme;
    };
  }, [theme]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const impersonatingCompany = readImpersonatingCompany();
  usePortalHubEvents();
  useSEO({
    title: `${title} | Client Portal`,
    description: "Digerati Experts Client Portal — secure access for existing clients.",
    noIndex: true,
  });

  const integrations = usePortalIntegrations(ready && !!user);
  const groups = useMemo(
    () => navGroupsFor(user, integrations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.orgRole, user?.role, user?.isCompanyItContact, integrations.vpn.mode, integrations.phone.mode, integrations.shipping.mode],
  );
  const current = findNavItem(location);

  const handleStopImpersonation = useCallback(async () => {
    try {
      const token = localStorage.getItem("portalToken");
      const response = await fetch("/api/portal/admin/stop-impersonation", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("portalToken", data.token);
        localStorage.removeItem("impersonatingCompany");
        resetPortalSession();
        window.location.href = "/portal/admin/companies";
      }
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
    } catch {
      /* still clear local */
    }
    localStorage.removeItem("portalUser");
    localStorage.removeItem("portalToken");
    localStorage.removeItem("portalUserId");
    localStorage.removeItem("impersonatingCompany");
    resetPortalSession();
    window.location.href = "/portal/login";
  }, []);

  if (!ready) {
    return (
      <div className="de-portal flex h-dvh items-center justify-center text-sm text-muted-foreground" data-theme={theme} role="status">
        Checking session…
      </div>
    );
  }

  const companyName = impersonatingCompany?.companyName || user?.client?.companyName || null;

  return (
    <div className={cn("de-portal", theme === "dark" && "dark")} data-theme={theme}>
      <SidebarProvider defaultOpen={typeof window === "undefined" ? true : window.innerWidth >= 1024}>
        <Sidebar collapsible="icon" className="border-sidebar-border">
          <nav aria-label="Client portal" className="flex h-full min-h-0 flex-col">
          <SidebarHeader className="px-3 pb-2 pt-3">
            <Link href="/portal/dashboard" className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Digerati Experts client portal home">
              <img src={DE_MARK} alt="" className="h-7 w-7 shrink-0 group-data-[collapsible=icon]:block hidden" />
              <img src={DE_LOGO_REVERSE} alt="Digerati Experts" className="h-7 w-auto group-data-[collapsible=icon]:hidden" />
            </Link>
            {companyName && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-2.5 py-1.5 text-xs text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                <span className="h-1.5 w-1.5 shrink-0 pt-dot-ok rounded-full" aria-hidden="true" />
                <span className="truncate">{companyName}</span>
              </div>
            )}
            {user?.role === "admin" && (
              // Below 1024px the topbar switcher is hidden; admins switch company here.
              <div className="mt-2 lg:hidden group-data-[collapsible=icon]:hidden" data-testid="sidebar-tenant-selector">
                <TenantSelector currentTenant={impersonatingCompany ? { id: impersonatingCompany.id ?? "", companyName: impersonatingCompany.companyName ?? "" } : null} />
              </div>
            )}
          </SidebarHeader>

          <SidebarContent>
            {groups.map((group) => (
              <SidebarGroup key={group.id} className="py-1">
                <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/60">{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(item, location);
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                            className="pt-active-nav"
                          >
                            <Link href={item.href} aria-current={active ? "page" : undefined}>
                              <Icon aria-hidden="true" />
                              <span>{item.label}</span>
                              {item.sample && (
                                <Token label="sample" tone="warn" className="ml-auto px-1.5 py-0 text-[9px] group-data-[collapsible=icon]:hidden" title="Sample content until this program is live" />
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-2">
            <div className="flex items-center gap-2 rounded-md px-1 py-1">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-[11px] font-semibold text-sidebar-accent-foreground" aria-hidden="true">
                {initialsOf(user)}
              </span>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm text-sidebar-accent-foreground">{user?.fullName || user?.email}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/70">{roleLabel(user)}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
                aria-label="Sign out"
                data-testid="button-sign-out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </SidebarFooter>
          </nav>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-[hsl(var(--pt-topbar))] px-3 backdrop-blur md:px-5">
            <SidebarTrigger className="h-9 w-9 text-foreground hover:bg-accent" aria-label="Toggle navigation" />
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground md:flex">
              {current?.group && <span className="hidden truncate lg:inline">{current.group.label}</span>}
              {current?.group && <span className="hidden lg:inline" aria-hidden="true">/</span>}
              <span className="truncate font-medium text-foreground" aria-current="page">{current?.item.label ?? title}</span>
            </nav>
            <span className="truncate text-sm font-medium md:hidden">{title}</span>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPaletteOpen(true)}
                className="hidden h-9 w-64 justify-start gap-2 border-border bg-card px-3 font-normal text-muted-foreground hover:bg-accent hover:text-foreground md:flex"
                data-testid="button-command-palette"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1 text-left text-sm">Search or jump to…</span>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
              </Button>
              <Button variant="outline" size="icon" onClick={() => setPaletteOpen(true)} className="h-9 w-9 border-border bg-card hover:bg-accent md:hidden" aria-label="Search or jump to a page">
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
              {user?.role === "admin" && (
                <div className="hidden lg:block">
                  <TenantSelector currentTenant={impersonatingCompany ? { id: impersonatingCompany.id ?? "", companyName: impersonatingCompany.companyName ?? "" } : null} />
                </div>
              )}
              {impersonatingCompany && (
                <Button size="sm" variant="secondary" onClick={handleStopImpersonation} className="hidden sm:inline-flex">
                  Exit {impersonatingCompany?.companyName || "company"}
                </Button>
              )}
              <PortalActivityPopover />
              <PortalUserMenu user={user} themePreference={themePreference} onTheme={setThemePreference} onSignOut={handleLogout} />
            </div>
          </header>

          {impersonatingCompany && (
            <div className="pt-warn-strip border-b px-4 py-1.5 text-xs" role="status">
              Viewing as <strong>{impersonatingCompany.companyName || "a client company"}</strong>.{" "}
              <button type="button" onClick={handleStopImpersonation} className="underline underline-offset-2">Exit</button>
            </div>
          )}

          <main id="main-content" tabIndex={-1} className={cn("mx-auto w-full flex-1 px-4 py-5 md:px-6 md:py-6", widthClass[width])}>
            {!hideHeader && (
              <PageHeader
                title={title}
                eyebrow={eyebrow}
                description={description}
                actions={actions}
                backHref={backHref}
                backLabel={backLabel}
                titleTestId={titleTestId}
              />
            )}
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <PortalCommandPalette groups={groups} open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={handleLogout} />
    </div>
  );
}

export { firstName as portalFirstName };
