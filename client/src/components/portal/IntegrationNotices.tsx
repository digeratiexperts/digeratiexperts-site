import { Link } from "wouter";
import { Building2, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/portal/ui";

/**
 * Shared states for the VPN, phone and shipping pages
 * (client/src/lib/portalIntegrations.ts). Each page renders these inside its
 * own PortalLayout.
 */

/** The page's data source is switched to "hidden": say so plainly. */
export function IntegrationHiddenNotice({ what }: { what: string }) {
  return (
    <Panel id="integration-hidden" flush>
      <EmptyState
        icon={EyeOff}
        title={`${what} isn't available on your account`}
        description="Ask your DE account team if you expected to see it here."
        action={
          <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
            <Link href="/portal/dashboard" data-testid="link-integration-hidden-dashboard">
              Back to dashboard
            </Link>
          </Button>
        }
      />
    </Panel>
  );
}

/** A live page with no company in view (a DE admin in admin view). */
export function IntegrationNeedsCompanyNotice({ what }: { what: string }) {
  return (
    <Panel id="integration-needs-company" flush>
      <EmptyState
        icon={Building2}
        title={`Pick a company to view its ${what}`}
        description="You are in the DE admin view, which has no client company of its own. Switch to a client with the company switcher, or open Manage Companies and use View Portal."
        action={
          <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
            <Link href="/portal/admin/companies" data-testid="link-integration-manage-companies">
              Manage Companies
            </Link>
          </Button>
        }
      />
    </Panel>
  );
}
