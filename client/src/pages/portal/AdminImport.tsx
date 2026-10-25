import { Link } from "wouter";
import { Database, Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { Panel, Token } from "@/components/portal/ui";

/**
 * Data Import (DE admin). Syncs from outside systems are run by DE ops on
 * request; there is no self-serve importer yet (docs/PORTAL-SAMPLE-BUILDOUT-PLAN.md,
 * slice H, decision D7). The bulk imports that do exist in the portal are linked
 * below. No buttons here pretend to start a sync.
 */

const SOURCES = [
  { system: "Zoho CRM", objects: "Companies", how: "DE ops runs the sync on request." },
  { system: "Zoho Desk", objects: "Contacts", how: "DE ops runs the sync on request." },
  { system: "JumpCloud", objects: "Users", how: "DE ops runs the import on request." },
  { system: "Seamless.ai", objects: "Prospect companies", how: "Not connected. A paid plan is needed first." },
];

const IN_PORTAL = [
  { label: "VPN devices", href: "/portal/vpn", text: "CSV import on the VPN Access page, while viewing as the company." },
  { label: "Shipments", href: "/portal/ship-center", text: "CSV import on the Ship Center page, while viewing as the company." },
];

const REQUEST_MAIL =
  "mailto:admin@digeratiexperts.com?subject=Data%20import%20request&body=Source%20system%3A%0AObject%20type%3A%0ACompany%20or%20record%20range%3A%0AOne-time%20or%20recurring%3A%0A";

export function AdminImport() {
  return (
    <PortalLayout title="Data Import" description="Bring companies, contacts and users in from outside systems.">
      <div className="space-y-4">
        <Panel id="import-sources" title="Outside systems" description="DE ops runs these syncs. Ask with the button below." flush>
          <ul className="divide-y divide-border">
            {SOURCES.map((s) => (
              <li key={s.system} className="flex items-start gap-3 px-4 py-4 md:px-5" data-testid={`import-source-${s.system.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{s.system}</h3>
                    <Token label={s.objects} tone="neutral" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.how}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="import-in-portal" title="Bulk imports you can run now" flush>
          <ul className="divide-y divide-border">
            {IN_PORTAL.map((i) => (
              <li key={i.href} className="flex items-start gap-3 px-4 py-4 md:px-5">
                <Upload className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <Link href={i.href} className="text-sm font-semibold underline">
                    {i.label}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">{i.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          id="request-import"
          title={
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Ask DE ops for a sync
            </span>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Say which system, which records (companies, contacts or users), which company or range, and whether it is one-time
              or recurring. Never send API keys by email.
            </p>
            <Button asChild variant="brand" data-testid="button-request-import">
              <a href={REQUEST_MAIL}>Email DE ops</a>
            </Button>
          </div>
        </Panel>
      </div>
    </PortalLayout>
  );
}
