import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PortalLayout } from "@/pages/portal/PortalLayout";
import {
  PORTAL_NAV_HUBS,
  PORTAL_NAV_ITEMS,
  type PortalNavItem,
} from "@/components/portal/shell/portalNav";
import { cn } from "@/lib/utils";

/**
 * Target-menu hubs (lane A, plan Phase 2 "merges"). A hub is the single menu
 * entry for the routes it merges; its tab bar and cards link to those routes,
 * which keep working unchanged (nothing is embedded or deleted). Wave 2 lanes
 * may turn a hub's tabs into embedded views when the member pages are split
 * from their shells.
 */

function membersOf(hubHref: string): PortalNavItem[] {
  const hub = PORTAL_NAV_ITEMS.find((item) => item.href === hubHref);
  return (hub?.children ?? [])
    .map((href) => PORTAL_NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is PortalNavItem => Boolean(item));
}

const tabClass =
  "rounded-[3px] border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PortalHubPage({ hubHref }: { hubHref: string }) {
  const hub = PORTAL_NAV_ITEMS.find((item) => item.href === hubHref);
  const members = membersOf(hubHref);
  if (!hub) return null;
  return (
    <PortalLayout title={hub.target?.label ?? hub.label} description={hub.hint} width="wide">
      <div className="space-y-5">
        <nav aria-label={`${hub.label} sections`} className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          {members.map((member) => (
            <Link key={member.href} href={member.href} className={tabClass} data-testid={`hub-tab-${member.href.split("/").pop()}`}>
              {member.target?.label ?? member.label}
            </Link>
          ))}
        </nav>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const Icon = member.icon;
            return (
              <li key={member.href}>
                <Link
                  href={member.href}
                  className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors pt-hover-brand hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`hub-card-${member.href.split("/").pop()}`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm font-semibold">{member.target?.label ?? member.label}</span>
                  </span>
                  {member.hint && <span className="text-xs text-muted-foreground">{member.hint}</span>}
                  <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs text-foreground">
                    Open <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </PortalLayout>
  );
}

/** Compact list of the routes a hub merges — used where a merged page is Home itself. */
export function PortalHubPanel({
  hubHref,
  title,
  className,
}: {
  hubHref: string;
  title?: string;
  className?: string;
}) {
  const members = membersOf(hubHref);
  if (members.length === 0) return null;
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)} aria-label={title ?? "More in this section"}>
      {title && <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</h2>}
      <ul className="divide-y divide-border">
        {members.map((member) => {
          const Icon = member.icon;
          return (
            <li key={member.href}>
              <Link
                href={member.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`hub-panel-${member.href.split("/").pop()}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{member.target?.label ?? member.label}</span>
                  {member.hint && <span className="block truncate text-xs text-muted-foreground">{member.hint}</span>}
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HelpHub() {
  return <PortalHubPage hubHref="/portal/help" />;
}
export function PeopleDevicesHub() {
  return <PortalHubPage hubHref="/portal/people-devices" />;
}
export function BillingContractsHub() {
  return <PortalHubPage hubHref="/portal/billing-contracts" />;
}
export function OrderEquipmentHub() {
  return <PortalHubPage hubHref="/portal/order-equipment" />;
}
export function ItPlanHub() {
  return <PortalHubPage hubHref="/portal/it-plan" />;
}

export { PORTAL_NAV_HUBS };
