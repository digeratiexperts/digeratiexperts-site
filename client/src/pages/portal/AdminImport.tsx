import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Mail } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Callout, Panel, Token } from "@/components/portal/ui";

interface ImportJob {
  id: string;
  system: string;
  status: "unavailable";
  description: string;
}

const importSystems: ImportJob[] = [
  {
    id: "1",
    system: "Zoho CRM (Companies)",
    status: "unavailable",
    description: "Company sync is handled by DE ops — not self-serve from this page.",
  },
  {
    id: "2",
    system: "Zoho Desk (Contacts)",
    status: "unavailable",
    description: "Contact sync is handled by DE ops — not self-serve from this page.",
  },
  {
    id: "3",
    system: "JumpCloud (Users)",
    status: "unavailable",
    description: "User directory imports require ops configuration.",
  },
  {
    id: "4",
    system: "Seamless.ai (Companies)",
    status: "unavailable",
    description: "Prospect imports require ops configuration.",
  },
];

export function AdminImport() {
  const [showContactNote, setShowContactNote] = useState(false);

  return (
    <PortalLayout title="Data Import" description="External system imports are not available as a self-serve action in this admin UI.">
      <div className="space-y-4">
        <Callout tone="warn" title="No simulated imports">
          This page previously simulated successful syncs. Live import jobs are not wired here. Contact DE ops to run or
          schedule a sync from Zoho, JumpCloud, or Seamless.ai.
        </Callout>

        <Panel id="import-systems" title="Import sources" description="Each source is run by DE ops on request." flush>
          <ul className="divide-y divide-border">
            {importSystems.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5" data-testid={`import-card-${job.id}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{job.system}</h3>
                      <Token label="Contact ops" tone="neutral" />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{job.description}</p>
                  </div>
                </div>
                <Button disabled variant="outline" className="shrink-0 border-border bg-card" data-testid={`button-import-${job.id}`}>
                  Run Import (unavailable)
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          id="contact-ops"
          title={
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Contact DE ops
            </span>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To request a data import or sync, email ops with the system name, environment (prod/preview), and any filters
              or record ranges needed. Do not paste API keys into this UI.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="brand" data-testid="button-contact-ops">
                <a href="mailto:admin@digeratiexperts.com?subject=Admin%20data%20import%20request">Email DE ops</a>
              </Button>
              <Button
                variant="outline"
                className="border-border bg-card hover:bg-accent"
                onClick={() => setShowContactNote((v) => !v)}
                aria-expanded={showContactNote}
                data-testid="button-ops-details"
              >
                {showContactNote ? "Hide details" : "What to include"}
              </Button>
            </div>
            {showContactNote && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Source system (Zoho CRM, Zoho Desk, JumpCloud, Seamless.ai)</li>
                <li>Object type (companies, contacts, users)</li>
                <li>Target environment and urgency</li>
                <li>Whether this is a one-time import or recurring sync</li>
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </PortalLayout>
  );
}
