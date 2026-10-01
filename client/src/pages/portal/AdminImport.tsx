import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Mail } from "lucide-react";
import { PortalLayout } from "./PortalLayout";

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
    <div className="space-y-6">
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-medium">No simulated imports</p>
            <p>
              This page previously simulated successful syncs. Live import jobs are not wired here.
              Contact DE ops to run or schedule a sync from Zoho, JumpCloud, or Seamless.ai.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {importSystems.map((job) => (
          <Card key={job.id} data-testid={`import-card-${job.id}`}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                  <div>
                    <h3 className="font-semibold">{job.system}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {job.description}
                    </p>
                  </div>
                </div>
                <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                  CONTACT OPS
                </Badge>
              </div>

              <Button
                disabled
                className="bg-[#D3126A]/40 cursor-not-allowed"
                data-testid={`button-import-${job.id}`}
              >
                Run Import (unavailable)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#D3126A]/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact DE ops
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            To request a data import or sync, email ops with the system name, environment (prod/preview),
            and any filters or record ranges needed. Do not paste API keys into this UI.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              className="bg-[#D3126A] hover:bg-[#D3126A]/90"
              data-testid="button-contact-ops"
            >
              <a href="mailto:admin@digeratiexperts.com?subject=Admin%20data%20import%20request">
                Email DE ops
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowContactNote((v) => !v)}
              data-testid="button-ops-details"
            >
              {showContactNote ? "Hide details" : "What to include"}
            </Button>
          </div>
          {showContactNote && (
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc pl-5 space-y-1">
              <li>Source system (Zoho CRM, Zoho Desk, JumpCloud, Seamless.ai)</li>
              <li>Object type (companies, contacts, users)</li>
              <li>Target environment and urgency</li>
              <li>Whether this is a one-time import or recurring sync</li>
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
    </PortalLayout>
  );
}
