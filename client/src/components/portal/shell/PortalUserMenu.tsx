import { Link } from "wouter";
import { ChevronDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortalUserSession } from "@/lib/portalRoles";
import { resolveOrgRole } from "@/lib/portalRoles";
import type { PortalThemePreference } from "./portalTheme";

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

const THEME_OPTIONS: { value: PortalThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Match device", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "light", label: "Light", Icon: Sun },
];

interface Props {
  user: PortalUserSession | null;
  themePreference: PortalThemePreference;
  onTheme: (t: PortalThemePreference) => void;
  onSignOut: () => void;
  compact?: boolean;
}

export function PortalUserMenu({ user, themePreference, onTheme, onSignOut, compact }: Props) {
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
        <DropdownMenuLabel className="pb-1 pt-1.5 text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground" id="menu-theme-label">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={themePreference}
          onValueChange={(v) => onTheme(v as PortalThemePreference)}
          aria-labelledby="menu-theme-label"
          data-testid="menu-theme"
        >
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} data-testid={`menu-theme-${value}`}>
              <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
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
