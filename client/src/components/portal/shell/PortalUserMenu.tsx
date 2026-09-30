import { Link } from "wouter";
import { ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortalUserSession } from "@/lib/portalRoles";
import { resolveOrgRole } from "@/lib/portalRoles";
import type { PortalTheme } from "./portalTheme";

const ROLE_LABEL: Record<string, string> = {
  staff: "Staff",
  manager: "Manager",
  dept_it_contact: "Department IT contact",
  company_it_contact: "Company IT contact",
};

export function initialsOf(user: PortalUserSession | null): string {
  const name = user?.fullName?.trim() || user?.email || "";
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

export function roleLabel(user: PortalUserSession | null): string {
  if (user?.role === "admin") return "DE administrator";
  return ROLE_LABEL[resolveOrgRole(user)] ?? "Portal user";
}

interface Props {
  user: PortalUserSession | null;
  theme: PortalTheme;
  onTheme: (t: PortalTheme) => void;
  onSignOut: () => void;
  compact?: boolean;
}

export function PortalUserMenu({ user, theme, onTheme, onSignOut, compact }: Props) {
  const name = user?.fullName || user?.email || "Portal user";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Account menu for ${name}`}
        data-testid="button-user-menu"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[11px] font-semibold" aria-hidden="true">
          {initialsOf(user)}
        </span>
        {!compact && <span className="hidden max-w-[140px] truncate text-sm sm:inline">{name.split(" ")[0]}</span>}
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{roleLabel(user)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onTheme(theme === "dark" ? "light" : "dark")} data-testid="menu-theme">
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" aria-hidden="true" /> : <Moon className="mr-2 h-4 w-4" aria-hidden="true" />}
          {theme === "dark" ? "Switch to light" : "Switch to dark"}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/portal/settings" className="flex w-full cursor-pointer items-center">
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} data-testid="menu-sign-out">
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
